import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { AuthorizeQuery } from './dto/authorize.dto';
import { OidcError } from '../common/oidc-errors';

function extractSession(req: Request): { userId: string; tenantId: string } | null {
  const sid = req.cookies?.zonadev_sid;
  if (!sid) {
    return null;
  }

  try {
    const parts = sid.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const expectedIssuer = process.env.JWT_ISSUER ?? 'https://auth.zonadev.tech';

    if (payload.iss !== expectedIssuer) {
      return null;
    }

    if (!payload.sub || !payload.tenantId) {
      return null;
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { userId: payload.sub, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('authorize')
  async authorize(
    @Query() query: AuthorizeQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const required: Array<keyof AuthorizeQuery> = [
      'client_id',
      'redirect_uri',
      'response_type',
      'state',
      'code_challenge',
      'code_challenge_method',
    ];
    const missing = required.filter((param) => !query[param]);

    if (missing.length > 0) {
      res.status(400).json(
        OidcError.invalidRequest(`Parâmetros obrigatórios ausentes: ${missing.join(', ')}`),
      );
      return;
    }

    const session = extractSession(req);
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const { redirectTo } = await this.oauthService.authorize(query, session, meta);
    res.redirect(redirectTo);
  }

  @Get('authorize/resume')
  async resume(
    @Query('resume') resumeId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!resumeId) {
      res.status(400).json(OidcError.invalidRequest('Parâmetro resume ausente'));
      return;
    }

    const session = extractSession(req);

    if (!session) {
      const baseUrl = process.env.AUTH_BASE_URL ?? '';
      res.redirect(`${baseUrl}/login`);
      return;
    }

    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const { redirectTo } = await this.oauthService.resume(resumeId, session, meta);
    res.redirect(redirectTo);
  }
}