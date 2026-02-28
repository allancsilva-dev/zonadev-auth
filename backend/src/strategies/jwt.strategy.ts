import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  jti: string;
  tokenVersion: number;
  tenantId: string | null;
  tenantSubdomain: string | null;
  plan: string | null;
  role: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject('JWT_PUBLIC_KEY') publicKey: string,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.access_token ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      // clockTolerance é passado via jsonWebTokenOptions — RFC 7519 recomenda 60s
      // para tolerância de clock skew entre servidor Auth e servidores cliente
      jsonWebTokenOptions: {
        clockTolerance: 60,
      },
    } as any);
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Token inválido');
    }
    return payload;
  }
}
