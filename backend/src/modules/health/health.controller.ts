import { Controller, Get, HttpCode, HttpStatus, Inject, HttpException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants';
import Redis from 'ioredis';

export class HealthResponseDto {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: { status: 'ok' | 'unavailable'; latency_ms: number | null };
    redis: { status: 'ok' | 'unavailable'; latency_ms: number | null };
  };
}

@Controller('health')
@SkipThrottle()
export class HealthController {
  // in-memory cache per-instance (controllers are singletons in Nest)
  private _cache: { payload: HealthResponseDto; expiresAt: number } | null = null;

  private readonly cacheTtlMs =
    Number(process.env.HEALTH_CACHE_TTL_MS) > 0
      ? Number(process.env.HEALTH_CACHE_TTL_MS)
      : 5_000;

  private readonly timeoutMs =
    Number(process.env.HEALTH_TIMEOUT_MS) > 0
      ? Number(process.env.HEALTH_TIMEOUT_MS)
      : 1_500;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  // Liveness: only check that the process is alive
  @Get()
  @HttpCode(HttpStatus.OK)
  async live(): Promise<{ status: 'ok' }> {
    return { status: 'ok' };
  }

  // Readiness: check DB and Redis, with caching and timeouts
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(): Promise<HealthResponseDto> {
    const now = Date.now();
    if (this._cache && this._cache.expiresAt > now) {
      return this._cache.payload;
    }

    const [database, redis] = await Promise.all([
      this.checkDatabase(this.timeoutMs),
      this.checkRedis(this.timeoutMs),
    ]);

    const overall: 'ok' | 'degraded' = database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';

    const payload: HealthResponseDto = {
      status: overall,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };

    // cache for a short period to avoid thundering herd
    this._cache = { payload, expiresAt: Date.now() + this.cacheTtlMs };

    if (overall === 'degraded') {
      throw new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return payload;
  }

  private async checkDatabase(timeoutMs: number): Promise<{ status: 'ok' | 'unavailable'; latency_ms: number | null }> {
    const start = Date.now();
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      return { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      return { status: 'unavailable', latency_ms: null };
    }
  }

  private async checkRedis(timeoutMs: number): Promise<{ status: 'ok' | 'unavailable'; latency_ms: number | null }> {
    const start = Date.now();
    try {
      await Promise.race([
        this.redisClient.ping(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      return { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      return { status: 'unavailable', latency_ms: null };
    }
  }
}
