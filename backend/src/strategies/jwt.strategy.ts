import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  tokenVersion: number;
  tenantId: string | null;
  tenantSubdomain: string | null;
  plan: string | null;
  roles: string[];
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      // clockTolerance é passado via jsonWebTokenOptions — RFC 7519 recomenda 60s
      // para tolerância de clock skew entre servidor Auth e servidores cliente
      jsonWebTokenOptions: {
        clockTolerance: 60,
      },
    } as StrategyOptionsWithoutRequest);
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Token inválido');
    }

    const expectedAud = process.env.JWT_EXPECTED_AUD ?? 'auth.zonadev.tech';
    const tokenAud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    if (tokenAud && tokenAud !== expectedAud) {
      throw new UnauthorizedException('Invalid audience');
    }

    const validRoles = Object.values(Role) as string[];
    if (!payload.roles.every((role) => validRoles.includes(role))) {
      throw new UnauthorizedException('Token inválido');
    }

    return payload;
  }
}
