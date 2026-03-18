import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import type Redis from 'ioredis';
import KeyvRedis from '@keyv/redis';
import Keyv from 'keyv';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { App } from '../../entities/app.entity';
import { Session } from '../../entities/session.entity';
import { UserAppAccess } from '../../entities/user-app-access.entity';
import { RedisModule } from '../redis/redis.module';
import { Subscription } from '../../entities/subscription.entity';
import { AppCacheModule } from '../app/app-cache.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, Subscription, App, Session, UserAppAccess]),
    CacheModule.registerAsync({
      isGlobal: false,
      useFactory: () => {
        const host = process.env.REDIS_HOST ?? 'redis';
        const port = process.env.REDIS_PORT ?? '6379';
        const password = process.env.REDIS_PASSWORD;
        const auth = password ? `:${password}@` : '';
        const redisUrl = `redis://${auth}${host}:${port}`;

        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(redisUrl),
              namespace: 'cache',
              ttl: 60000, // ms
            }),
          ],
        } as any;
      },
    }),
    RedisModule,
    AppCacheModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
