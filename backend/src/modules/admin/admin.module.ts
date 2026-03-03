import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import type Redis from 'ioredis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { RedisModule } from '../redis/redis.module';
import { Subscription } from '../../entities/subscription.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, Subscription]),
    CacheModule.registerAsync({
      isGlobal: false,
      useFactory: async () => {
        const { redisStore } = await import('cache-manager-ioredis-yet');
        return {
          store: redisStore,
          host: process.env.REDIS_HOST ?? 'redis',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          ttl: 60,
        } as any;
      },
    }),
    RedisModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
