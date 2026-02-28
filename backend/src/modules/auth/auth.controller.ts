import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { importSPKI, exportJWK } from 'jose';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../guards/jwt.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Login ─────────────────────────────────────────────────────────────────
  // Rate limit: 10 req / 15 min por IP — proteção contra força bruta de senha
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────
  // Rate limit: 30 req / min — proteção contra flood de refresh token
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res() res: Response) {
    return this.authService.refresh(req, res);
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  // Rate limit: 20 req / min — proteção básica
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(@Req() req: Request, @Res() res: Response) {
    return this.authService.logout(req, res);
  }

  // ─── Forgot Password ───────────────────────────────────────────────────────
  // Rate limit: 5 req / 15 min — proteção contra abuso de SMTP
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    // Resposta sempre genérica — anti-enumeration
    return { message: 'Se o e-mail existir, você receberá um link de recuperação' };
  }

  // ─── Reset Password ────────────────────────────────────────────────────────
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Senha redefinida com sucesso' };
  }

  // ─── Verify Email ──────────────────────────────────────────────────────────
  @Get('auth/verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    return this.authService.verifyEmail(token, res);
  }

  // ─── JWKS ──────────────────────────────────────────────────────────────────
  // Sem autenticação, sem rate limit — público, cacheado pelo cliente por 5 min
  @Get('.well-known/jwks.json')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async jwks(@Res() res: Response) {
    const publicKeyPem = this.authService.getPublicKey();

    // Usa `jose` para converter PEM → JWK (extrai n e e em base64url)
    const publicKey = await importSPKI(publicKeyPem, 'RS256');
    const jwk = await exportJWK(publicKey);

    const kid = process.env.JWT_KID ?? 'zonadev-default';

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      keys: [
        {
          kty: jwk.kty,
          use: 'sig',
          alg: 'RS256',
          kid,
          n: jwk.n,
          e: jwk.e,
        },
      ],
    });
  }
}
