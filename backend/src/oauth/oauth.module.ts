import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ClientsModule, SessionsModule, GrantsModule } from '../oidc.modules';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

function loadKey(envPath: string, fallback: string): string {
  const keyPath = process.env[envPath] ?? fallback;
  return readFileSync(resolve(process.cwd(), keyPath), 'utf8');
}

@Module({
  imports: [
    ClientsModule,
    SessionsModule,
    GrantsModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: loadKey('JWT_PRIVATE_KEY_PATH', './keys/private.pem'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: Number(process.env.JWT_ACCESS_EXPIRES ?? 900),
          issuer: process.env.JWT_ISSUER ?? 'https://auth.zonadev.tech',
        },
      }),
    }),
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}