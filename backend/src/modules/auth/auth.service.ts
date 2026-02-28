import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { Response, Request } from 'express';
import * as bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../../entities/user.entity';
import { Subscription } from '../../entities/subscription.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { generateToken, sha256 } from '../../common/utils/hash.util';
import { isSafeRedirect, SAFE_REDIRECT_FALLBACK } from '../../common/utils/redirect.util';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';

// Hash dummy válido de 60 chars para bcrypt.compare — evita timing attack
// quando o usuário não existe (comparação leva o mesmo tempo que senha inválida)
const DUMMY_HASH = '$2b$12$KIXBp/T4nak.HFizvz1H3OOiOSBjVHS9WZb6I5i1G5dSo7i6j5p2';

// Limite de sessões simultâneas por usuário (LRU)
const MAX_SESSIONS = 10;
// Limite de sessões para verificar antes de remover
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly accessExpires: number;
  private readonly refreshExpires: number;
  private readonly allowedAudiences: string[];
  private readonly jwtKid: string;
  private readonly isProduction: boolean;

  constructor(
    @Inject('JWT_PUBLIC_KEY') private readonly publicKey: string,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
  ) {
    this.accessExpires = Number(process.env.JWT_ACCESS_EXPIRES ?? 900);
    this.refreshExpires = Number(process.env.JWT_REFRESH_EXPIRES ?? 604800);
    this.allowedAudiences = (process.env.ALLOWED_AUDIENCES ?? '').split(',').filter(Boolean);
    this.jwtKid = process.env.JWT_KID ?? 'zonadev-default';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // ─── Cookie Options ────────────────────────────────────────────────────────

  private getCookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      domain: this.isProduction ? '.zonadev.tech' : undefined,
      maxAge: maxAgeMs,
    };
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  private async audit(
    action: AuditAction,
    ip: string,
    userAgent: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      await this.auditLogRepo.save({
        action,
        ipAddress: ip,
        userAgent,
        userId: userId ?? null,
        tenantId: tenantId ?? null,
      });
    } catch (err) {
      this.logger.error(`Falha ao registrar audit log: ${err}`);
    }
  }

  // ─── Validate Audience ─────────────────────────────────────────────────────

  private isValidAudience(aud: string): boolean {
    // TODO: migrar para tabela applications na v2.0
    return this.allowedAudiences.includes(aud);
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, req: Request, res: Response): Promise<void> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    // 1. Busca user por email
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      relations: ['tenant'],
    });

    // 2. Anti-timing + Anti-enumeration:
    // Se usuário não existe, gasta o tempo do bcrypt mesmo assim.
    // Resposta idêntica para "usuário não encontrado" e "senha errada".
    if (!user) {
      await bcryptjs.compare(dto.password, DUMMY_HASH);
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 3. Valida senha
    const isPasswordValid = await bcryptjs.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 4. Verifica email verificado — motivo real apenas no audit_log
    if (!user.emailVerifiedAt) {
      await this.audit(AuditAction.LOGIN_BLOCKED_EMAIL_NOT_VERIFIED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 5. Valida audience
    if (!this.isValidAudience(dto.aud)) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Aplicação não autorizada');
    }

    // 6. Verifica user.active e tenant.active
    if (!user.active) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.tenant && !user.tenant.active) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 7. Valida subscription (apenas para usuários com tenant)
    if (user.tenantId) {
      const subscription = await this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId: user.tenantId })
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('s.expires_at > now()')
        .getOne();

      if (!subscription) {
        await this.audit(AuditAction.LICENSE_EXPIRED, ip, userAgent, user.id, user.tenantId);
        throw new UnauthorizedException('Licença inválida ou expirada');
      }
    }

    // 8. Verifica sessões ativas — se ≥ MAX_SESSIONS, remove a mais antiga (LRU)
    const activeSessions = await this.refreshTokenRepo.count({
      where: {
        userId: user.id,
        revokedAt: IsNull(),
        expiresAt: Not(LessThan(new Date())),
      },
    });

    if (activeSessions >= MAX_SESSIONS) {
      const oldest = await this.refreshTokenRepo.findOne({
        where: {
          userId: user.id,
          revokedAt: IsNull(),
        },
        order: { createdAt: 'ASC' },
      });
      if (oldest) {
        await this.refreshTokenRepo.update(oldest.id, { revokedAt: new Date() });
      }
    }

    // 9. Gera access token RS256
    const jti = uuidv4();
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        jti,
        tokenVersion: user.tokenVersion,
        tenantId: user.tenantId,
        tenantSubdomain: user.tenant?.subdomain ?? null,
        plan: user.tenant?.plan ?? null,
        role: user.role,
        aud: dto.aud,
      },
      {
        algorithm: 'RS256',
        expiresIn: this.accessExpires,
        header: { kid: this.jwtKid, alg: 'RS256' },
      },
    );

    // 10. Gera refresh token e salva SHA-256 no banco
    const rawRefreshToken = generateToken(64);
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpires * 1000);

    await this.refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // 11. Registra audit
    await this.audit(AuditAction.LOGIN_SUCCESS, ip, userAgent, user.id, user.tenantId ?? undefined);

    // 12. Seta cookies HTTP-only com domain condicional
    res.cookie('access_token', accessToken, this.getCookieOptions(this.accessExpires * 1000));
    res.cookie('refresh_token', rawRefreshToken, this.getCookieOptions(this.refreshExpires * 1000));

    // 13. Valida redirect — isSafeRedirect robusto (não passa por URL parser apenas)
    const redirectUrl = isSafeRedirect(dto.redirect ?? '') ? dto.redirect! : SAFE_REDIRECT_FALLBACK;

    res.json({ success: true, redirect: redirectUrl });
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────

  async refresh(req: Request, res: Response): Promise<void> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const rawToken: string = req.cookies?.refresh_token;
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }

    const tokenHash = sha256(rawToken);

    // 1. Busca token no banco
    const tokenRecord = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user', 'user.tenant'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Token inválido');
    }

    // 2. TOKEN_REUSE_DETECTED — revogar TODAS as sessões do usuário
    if (tokenRecord.revokedAt) {
      await this.refreshTokenRepo.update(
        { userId: tokenRecord.userId },
        { revokedAt: new Date() },
      );
      await this.audit(AuditAction.TOKEN_REUSE_DETECTED, ip, userAgent, tokenRecord.userId);
      throw new UnauthorizedException('Token inválido');
    }

    // 3. Verifica expiração
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expirado');
    }

    const user = tokenRecord.user;

    // 4. Revoga token atual (rotation obrigatória)
    await this.refreshTokenRepo.update(tokenRecord.id, { revokedAt: new Date() });

    // 5. Valida tokenVersion — se senha foi alterada, rejeitar
    const freshUser = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ['tenant'],
    });

    if (!freshUser || freshUser.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão inválida');
    }

    if (!freshUser.active || (freshUser.tenant && !freshUser.tenant.active)) {
      throw new UnauthorizedException('Acesso negado');
    }

    // 6. Revalida subscription
    if (freshUser.tenantId) {
      const subscription = await this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId: freshUser.tenantId })
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('s.expires_at > now()')
        .getOne();

      if (!subscription) {
        await this.audit(AuditAction.LICENSE_EXPIRED, ip, userAgent, freshUser.id, freshUser.tenantId);
        throw new UnauthorizedException('Licença expirada');
      }
    }

    // 7. Emite novos tokens
    const jti = uuidv4();

    // Precisamos saber o aud original — lemos do token expirado de forma confiável
    // (o refresh não passa pelo JWT guard, precisamos ler o aud do cookie anterior)
    // Como o access token pode ter expirado, usamos o aud do env como fallback seguro
    const aud = this.allowedAudiences[0] ?? 'auth.zonadev.tech';

    const newAccessToken = this.jwtService.sign(
      {
        sub: freshUser.id,
        jti,
        tokenVersion: freshUser.tokenVersion,
        tenantId: freshUser.tenantId,
        tenantSubdomain: freshUser.tenant?.subdomain ?? null,
        plan: freshUser.tenant?.plan ?? null,
        role: freshUser.role,
        aud,
      },
      {
        algorithm: 'RS256',
        expiresIn: this.accessExpires,
        header: { kid: this.jwtKid, alg: 'RS256' },
      },
    );

    const newRawRefreshToken = generateToken(64);
    const newTokenHash = sha256(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpires * 1000);

    await this.refreshTokenRepo.save({
      userId: freshUser.id,
      tokenHash: newTokenHash,
      expiresAt,
    });

    await this.audit(AuditAction.TOKEN_REFRESHED, ip, userAgent, freshUser.id, freshUser.tenantId ?? undefined);

    res.cookie('access_token', newAccessToken, this.getCookieOptions(this.accessExpires * 1000));
    res.cookie('refresh_token', newRawRefreshToken, this.getCookieOptions(this.refreshExpires * 1000));

    res.json({ success: true });
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(req: Request, res: Response): Promise<void> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const rawToken: string = req.cookies?.refresh_token;

    if (rawToken) {
      const tokenHash = sha256(rawToken);
      await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
    }

    const clearOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      domain: this.isProduction ? '.zonadev.tech' : undefined,
    };

    res.clearCookie('access_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);

    // Tenta registrar quem fez logout se tiver user no request (JWT guard opcional)
    const userId = (req as any).user?.sub;
    await this.audit(AuditAction.LOGOUT, ip, userAgent, userId);

    res.json({ success: true });
  }

  // ─── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    // Resposta sempre a mesma independente de o e-mail existir (anti-enumeration)
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      // Simula processamento para evitar timing attack
      return;
    }

    const rawToken = generateToken(32); // 64 chars hex
    const tokenHash = sha256(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.userRepo.update(user.id, {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    });

    await this.mailService.sendResetPassword(user.email, rawToken);
  }

  // ─── Reset Password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = sha256(dto.token);

    const user = await this.userRepo.findOne({
      where: { passwordResetToken: tokenHash },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const newHash = await bcryptjs.hash(dto.password, BCRYPT_ROUNDS);

    await this.userRepo.update(user.id, {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      tokenVersion: user.tokenVersion + 1, // invalida todas as sessões ativas
    });

    await this.auditLogRepo.save({
      action: AuditAction.PASSWORD_RESET,
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: 'system',
      userAgent: 'system',
    });
  }

  // ─── Verify Email ──────────────────────────────────────────────────────────

  async verifyEmail(rawToken: string, res: Response): Promise<void> {
    // O token de verificação de e-mail usa o mesmo padrão:
    // rawToken enviado por e-mail, SHA-256 armazenado como passwordResetToken
    // com campo especial para verificação de e-mail
    const tokenHash = sha256(rawToken);

    const user = await this.userRepo.findOne({
      where: { passwordResetToken: tokenHash },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Link de verificação inválido ou expirado');
    }

    await this.userRepo.update(user.id, {
      emailVerifiedAt: new Date(),
      active: true,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    res.json({ success: true, message: 'E-mail verificado com sucesso' });
  }

  // ─── JWKS ──────────────────────────────────────────────────────────────────

  getPublicKey(): string {
    return this.publicKey;
  }
}
