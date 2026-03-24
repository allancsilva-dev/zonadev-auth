import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Response, Request } from 'express';
import type Redis from 'ioredis';
import * as bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../../entities/user.entity';
import { Subscription } from '../../entities/subscription.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Session } from '../../entities/session.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { UserAppAccess } from '../../entities/user-app-access.entity';
import { App } from '../../entities/app.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { generateToken, sha256 } from '../../common/utils/hash.util';
import { isSafeRedirect, SAFE_REDIRECT_FALLBACK } from '../../common/utils/redirect.util';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { AppCacheService } from '../app/app-cache.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

const MAX_SESSIONS = 10;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private static readonly DUMMY_HASH: string = bcryptjs.hashSync(
    'dummy-placeholder-zonadev',
    12,
  );

  private readonly accessExpires: number;
  private readonly sessionExpires: number;
  private readonly jwtKid: string;
  private readonly isProduction: boolean;

  constructor(
    @Inject('JWT_PUBLIC_KEY') private readonly publicKey: string,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly appCacheService: AppCacheService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(UserAppAccess) private readonly uaaRepo: Repository<UserAppAccess>,
    @InjectRepository(App) private readonly appRepo: Repository<App>,
  ) {
    this.accessExpires = Number(process.env.JWT_ACCESS_EXPIRES ?? 900);
    this.sessionExpires = Number(process.env.SESSION_EXPIRES ?? 604800);
    this.jwtKid = process.env.JWT_KID ?? 'zonadev-default';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  getMe(user: import('../../strategies/jwt.strategy').JwtPayload) {
    return {
      sub: user.sub,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId,
      tenantSubdomain: user.tenantSubdomain,
      plan: user.plan,
    };
  }

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

  async issueAppToken(aud: string, req: Request, res: Response): Promise<void> {
    if (!aud || typeof aud !== 'string') {
      throw new BadRequestException('Audience ausente ou inválido');
    }

    const audNormalized = aud.toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(audNormalized)) {
      throw new BadRequestException('Formato de audience inválido');
    }

    const app = await this.appCacheService.getByAudience(audNormalized);
    if (!app) {
      throw new UnauthorizedException('Aplicacao nao autorizada');
    }

    const normalizeOrigin = (value: string): string => {
      try {
        return new URL(value).origin.toLowerCase();
      } catch {
        return value.toLowerCase().trim();
      }
    };

    const origin = req.headers.origin;
    const expectedBaseUrl = app.baseUrl ?? app.allowOrigin;
    if (origin && expectedBaseUrl && normalizeOrigin(origin) !== normalizeOrigin(expectedBaseUrl)) {
      this.logger.warn({
        event: 'TOKEN_EXCHANGE_BLOCKED_ORIGIN',
        aud: audNormalized,
        origin,
        expected: expectedBaseUrl,
        ip: req.ip,
      });
      throw new UnauthorizedException('Origin nao autorizada para este app');
    }

    const sid = req.cookies?.zonadev_sid;
    if (!sid) throw new UnauthorizedException('Sessao ausente');

    const session = await this.sessionRepo.findOne({
      where: { tokenHash: sha256(sid), revokedAt: IsNull() },
      relations: ['user', 'user.tenant'],
    });

    if (!session || session.expiresAt < new Date()) {
      this.logger.warn({ event: 'TOKEN_EXCHANGE_INVALID_SESSION', aud: audNormalized, ip: req.ip });
      throw new UnauthorizedException('Sessao expirada');
    }

    const isSuperAdmin = session.user.roles?.includes('SUPERADMIN');
    if (!session.user.tenantId && !isSuperAdmin) {
      this.logger.warn({ event: 'TOKEN_EXCHANGE_MISSING_TENANT', userId: session.user.id, ip: req.ip });
      throw new UnauthorizedException('Tenant inválido no usuário');
    }

    const access = await this.uaaRepo.findOne({
      where: {
        userId: session.user.id,
        appId: app.id,
        status: 'active',
        revokedAt: IsNull(),
      },
    });

    if (!access) {
      this.logger.warn({
        event: 'TOKEN_EXCHANGE_NO_APP_ACCESS',
        userId: session.user.id,
        app: audNormalized,
        ip: req.ip,
      });
      throw new UnauthorizedException('Sem acesso a esta aplicacao');
    }

    const userRateKey = `rate:token_exchange:${session.user.id}`;
    const count = await this.redisClient.incr(userRateKey);
    if (count === 1) {
      await this.redisClient.expire(userRateKey, 60);
    }
    if (count >= 30) {
      this.logger.warn({ event: 'TOKEN_EXCHANGE_RATE_LIMITED', userId: session.user.id, ip: req.ip });
      throw new HttpException('Rate limit por usuário atingido', HttpStatus.TOO_MANY_REQUESTS);
    }

    const startTime = Date.now();

    if (!session.user.active) {
      throw new UnauthorizedException('Usuario desativado');
    }

    if (session.user.tenant && !session.user.tenant.active) {
      throw new UnauthorizedException('Tenant desativado');
    }

    if (session.user.tenantId) {
      const subscription = await this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId: session.user.tenantId })
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('s.expires_at > now()')
        .getOne();

      if (!subscription) {
        throw new UnauthorizedException('Licenca expirada');
      }
    }

    const jti = uuidv4();
    const jwt = this.jwtService.sign(
      {
        sub: session.user.id,
        email: session.user.email,
        jti,
        tenantId: session.user.tenantId,
        tenantSubdomain: session.user.tenant?.subdomain ?? null,
        plan: session.user.tenant?.plan ?? null,
        // ⚠️ COMPATIBILIDADE TEMPORÁRIA
        // roles serão removidas após migração completa dos SaaS
        roles: session.user.roles ?? [],
        defaultRole: access.defaultRole,
        aud: audNormalized,
      },
      {
        algorithm: 'RS256',
        expiresIn: this.accessExpires,
        header: { kid: this.jwtKid, alg: 'RS256' },
      },
    );

    this.logger.log({
      event: 'TOKEN_EXCHANGE_SUCCESS',
      userId: session.user.id,
      email: session.user.email,
      app: audNormalized,
      ip: req.ip,
      origin: req.headers.origin ?? 'server-side',
      latencyMs: Date.now() - startTime,
    });

    res.json({
      access_token: jwt,
      expires_in: this.accessExpires,
      default_role: access.defaultRole,
    });
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<void> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      relations: ['tenant'],
    });

    if (!user) {
      await bcryptjs.compare(dto.password, AuthService.DUMMY_HASH);
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const isPasswordValid = await bcryptjs.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (!user.emailVerifiedAt) {
      await this.audit(AuditAction.LOGIN_BLOCKED_EMAIL_NOT_VERIFIED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const app = this.appCacheService.getAppByAudience(dto.aud);
    if (!app) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Aplicacao nao autorizada');
    }

    if (app.slug !== 'admin') {
      const appAccess = await this.uaaRepo.findOne({
        where: {
          userId: user.id,
          appId: app.id,
          status: 'active',
          revokedAt: IsNull(),
        },
      });

      if (!appAccess) {
        await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
        throw new UnauthorizedException('Sem acesso a esta aplicacao');
      }
    }

    if (!user.active) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.tenant && !user.tenant.active) {
      await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.tenantId) {
      const subscription = await this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tenantId', { tenantId: user.tenantId })
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('s.expires_at > now()')
        .getOne();

      if (!subscription) {
        await this.audit(AuditAction.LICENSE_EXPIRED, ip, userAgent, user.id, user.tenantId);
        throw new UnauthorizedException('Licenca invalida ou expirada');
      }
    }

    await this.sessionRepo.manager.transaction(async (em) => {
      const activeSessions = await em
        .createQueryBuilder(Session, 's')
        .where('s.user_id = :userId', { userId: user.id })
        .andWhere('s.revoked_at IS NULL')
        .andWhere('s.expires_at > NOW()')
        .orderBy('s.created_at', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      if (activeSessions.length >= MAX_SESSIONS) {
        await em.update(Session, activeSessions[0].id, { revokedAt: new Date() });
      }
    });

    const rawSid = generateToken(64);
    const sidHash = sha256(rawSid);
    const sessionExpiresAt = new Date(Date.now() + this.sessionExpires * 1000);

    await this.sessionRepo.save({
      userId: user.id,
      tokenHash: sidHash,
      ipAddress: ip,
      userAgent,
      expiresAt: sessionExpiresAt,
    });

    res.cookie('zonadev_sid', rawSid, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      domain: this.isProduction ? '.zonadev.tech' : undefined,
      maxAge: this.sessionExpires * 1000,
      path: '/',
    });

    await this.audit(AuditAction.LOGIN_SUCCESS, ip, userAgent, user.id, user.tenantId ?? undefined);

    const redirectUrl = isSafeRedirect(dto.redirect ?? '') ? dto.redirect! : SAFE_REDIRECT_FALLBACK;
    res.json({ success: true, redirect: redirectUrl });
  }

  async logout(req: Request, res: Response, postLogoutRedirectUri?: string): Promise<void> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const sid = req.cookies?.zonadev_sid;

    // Try to load full session to obtain user and tenant context
    let session: Session | null = null;
    if (sid) {
      session = await this.sessionRepo.findOne({
        where: { tokenHash: sha256(sid), revokedAt: IsNull() },
        relations: ['user', 'user.tenant'],
      });
    }

    // Revoke session record if present
    if (session) {
      await this.sessionRepo.update({ id: session.id }, { revokedAt: new Date() });
    } else if (sid) {
      // Best-effort: try updating by tokenHash if session entity wasn't loaded
      await this.sessionRepo.update({ tokenHash: sha256(sid) }, { revokedAt: new Date() });
    }

    // Revoke refresh tokens for the user (if known)
    try {
      const userId = session?.user?.id;
      if (userId) {
        await this.refreshTokenRepo.createQueryBuilder()
          .update(RefreshToken)
          .set({ revokedAt: new Date() })
          .where('user_id = :userId', { userId })
          .andWhere('revoked_at IS NULL')
          .execute();
      }
    } catch (err) {
      this.logger.error(`Failed to revoke refresh tokens: ${err}`);
    }

    // Clear cookies (keep same options used on login)
    res.clearCookie('zonadev_sid', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      domain: this.isProduction ? '.zonadev.tech' : undefined,
      path: '/',
    });

    const clearOld = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'none' as const,
      domain: this.isProduction ? '.zonadev.tech' : undefined,
      path: '/',
    };

    res.clearCookie('access_token', clearOld);
    res.clearCookie('refresh_token', clearOld);

    // Audit
    const userId = session?.user?.id ?? (req as any).user?.sub;
    await this.audit(AuditAction.LOGOUT, ip, userAgent, userId, session?.user?.tenantId ?? undefined);

    // Audit log to aid debugging and observability
    this.logger.log('Logout realizado', { userId, tenantId: session?.user?.tenantId ?? undefined, redirect: postLogoutRedirectUri });

    // If a post_logout_redirect_uri was provided, validate it against
    // the client's registered redirect URIs (per-tenant / per-user apps)
    if (postLogoutRedirectUri) {
      const normalizeUri = (u: string): string => {
        let url: URL;
        try {
          url = new URL(u);
        } catch (err) {
          throw new BadRequestException('Malformed post_logout_redirect_uri');
        }

        // Enforce HTTPS only for post logout redirects
        if (url.protocol !== 'https:') {
          throw new UnauthorizedException('Only HTTPS allowed for post_logout_redirect_uri');
        }

        // Strip hash to avoid mismatches caused by fragments
        url.hash = '';
        return url.toString().toLowerCase();
      };

      try {
        const requested = normalizeUri(postLogoutRedirectUri);

        // Build allowed exact URIs from user app access list if we have a user
        let allowedUris: string[] = [];

        if (session?.user?.id) {
          const uaa = await this.uaaRepo.find({
            where: { userId: session.user.id, status: 'active', revokedAt: IsNull() },
            relations: ['app'],
          });

          for (const u of uaa) {
            const app = u.app;
            if (!app) continue;
            if (Array.isArray((app as any).postLogoutRedirectUris) && (app as any).postLogoutRedirectUris.length > 0) {
              allowedUris.push(...(app as any).postLogoutRedirectUris);
            }
          }
        }

        // Fallback: gather registered post_logout_redirect_uris from all active apps
        if (allowedUris.length === 0) {
          const apps = await this.appRepo.find({ where: { active: true } });
          for (const a of apps) {
            if (Array.isArray((a as any).postLogoutRedirectUris) && (a as any).postLogoutRedirectUris.length > 0) {
              allowedUris.push(...(a as any).postLogoutRedirectUris);
            }
          }
        }

        // Normalize and compare exact URIs
        const allowedNormalized = allowedUris.map((x) => normalizeUri(x));

        if (allowedNormalized.includes(requested)) {
          this.logger.log('Logout realizado', { userId, tenantId: session?.user?.tenantId ?? undefined, redirect: postLogoutRedirectUri });
          res.redirect(postLogoutRedirectUri);
          return;
        }

        // If not matched, reject redirect for safety
        this.logger.warn('Blocked post_logout_redirect_uri not in whitelist', { requested, userId, tenantId: session?.user?.tenantId ?? undefined });
        res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Invalid post_logout_redirect_uri' });
        return;
      } catch (err) {
        if (err instanceof BadRequestException) {
          res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Malformed post_logout_redirect_uri' });
          return;
        }
        this.logger.error(`post_logout_redirect_uri validation error: ${err}`);
        res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid post_logout_redirect_uri' });
        return;
      }
    }

    // Default response: list local logout hooks for apps (back-compat)
    const apps = await this.appRepo.find({ where: { active: true } });
    const logoutUrls = apps
      .filter((a) => a.slug !== 'admin')
      .map((a) => `${a.allowOrigin}/api/auth/local-logout`);

    res.json({ success: true, logoutUrls });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      return;
    }

    const rawToken = generateToken(32);
    const tokenHash = sha256(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepo.update(user.id, {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    });

    await this.mailService.sendResetPassword(user.email, rawToken);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = sha256(dto.token);

    const user = await this.userRepo.findOne({
      where: { passwordResetToken: tokenHash },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    const newHash = await bcryptjs.hash(dto.password, BCRYPT_ROUNDS);

    await this.userRepo.update(user.id, {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      tokenVersion: user.tokenVersion + 1,
    });

    await this.auditLogRepo.save({
      action: AuditAction.PASSWORD_RESET,
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: 'system',
      userAgent: 'system',
    });
  }

  async verifyEmail(rawToken: string, res: Response): Promise<void> {
    const tokenHash = sha256(rawToken);

    const user = await this.userRepo.findOne({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Link de verificacao invalido ou expirado');
    }

    await this.userRepo.update(user.id, {
      emailVerifiedAt: new Date(),
      active: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    res.json({ success: true, message: 'E-mail verificado com sucesso' });
  }

  getPublicKey(): string {
    return this.publicKey;
  }
}
