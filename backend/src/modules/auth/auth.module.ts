import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { Subscription } from '../../entities/subscription.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { AuditLog } from '../../entities/audit-log.entity';

/**
 * Carrega as chaves RSA uma única vez no bootstrap via provider.
 * Evita leitura repetida de disco por request — otimização de produção.
 */
function loadKey(envPath: string, fallback: string): string {
  const keyPath = process.env[envPath] ?? fallback;
  return readFileSync(resolve(process.cwd(), keyPath), 'utf8');
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: loadKey('JWT_PRIVATE_KEY_PATH', './keys/private.pem'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: Number(process.env.JWT_ACCESS_EXPIRES ?? 900),
          issuer: process.env.JWT_ISSUER ?? 'auth.zonadev.tech',
        },
      }),
    }),
    TypeOrmModule.forFeature([User, Tenant, Subscription, RefreshToken, AuditLog]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: 'JWT_PRIVATE_KEY',
      useFactory: () => loadKey('JWT_PRIVATE_KEY_PATH', './keys/private.pem'),
    },
    {
      provide: 'JWT_PUBLIC_KEY',
      useFactory: () => loadKey('JWT_PUBLIC_KEY_PATH', './keys/public.pem'),
    },
  ],
  exports: ['JWT_PUBLIC_KEY', 'JWT_PRIVATE_KEY'],
})
export class AuthModule {}
