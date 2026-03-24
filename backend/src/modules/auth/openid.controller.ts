import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class OpenIdController {
  @Get('.well-known/openid-configuration')
  @HttpCode(HttpStatus.OK)
  async configuration(@Res() res: Response) {
    const issuer = process.env.JWT_ISSUER ?? `${process.env.BASE_URL ?? 'http://localhost:3000'}`;
    const jwksUri = `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
    const endSession = `${issuer.replace(/\/$/, '')}/auth/logout`;

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      issuer,
      jwks_uri: jwksUri,
      end_session_endpoint: endSession,
    });
  }
}
