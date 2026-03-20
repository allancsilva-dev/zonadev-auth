import { Controller, Get, Inject, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Response } from 'express';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AppCacheService } from '../app/app-cache.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly appCacheService: AppCacheService,
  ) {}

  @Get()
  async health(@Res() res: Response) {
    const checks = { db: false, redis: false, cache: false };

    try {
      await this.dataSource.query('SELECT 1');
      checks.db = true;
    } catch {
      // no-op
    }

    try {
      await this.redisClient.ping();
      checks.redis = true;
    } catch {
      // no-op
    }

    checks.cache = this.appCacheService.isLoaded();

    const healthy = Object.values(checks).every(Boolean);
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  async ready(@Res() res: Response) {
    const cacheOk = this.appCacheService.isLoaded();
    return res.status(cacheOk ? 200 : 503).json({ ready: cacheOk });
  }
}
