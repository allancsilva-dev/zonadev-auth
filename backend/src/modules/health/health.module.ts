import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { AppCacheModule } from '../app/app-cache.module';

@Module({
  imports: [RedisModule, AppCacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
