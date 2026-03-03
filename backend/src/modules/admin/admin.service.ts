import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { AdminStatsDto } from './dto/admin-stats.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  private isValidCache(data: unknown): data is AdminStatsDto {
    return (
      data !== null &&
      data !== undefined &&
      typeof (data as AdminStatsDto).tenantsActive === 'number' &&
      typeof (data as AdminStatsDto).totalUsers === 'number' &&
      typeof (data as AdminStatsDto).subscriptionsActive === 'number' &&
      typeof (data as AdminStatsDto).subscriptionsExpiringSoon === 'number'
    );
  }

  private async getSubscriptionStats(): Promise<{ subscriptionsActive: number; subscriptionsExpiringSoon: number }> {
    // Use PostgreSQL FILTER clause to get both counts in one scan
    const raw = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select(
        `COUNT(*) FILTER (WHERE s.status = :active) AS "subscriptionsActive", COUNT(*) FILTER (WHERE s.status = :active AND s.expires_at > NOW() AND s.expires_at < NOW() + INTERVAL '30 days') AS "subscriptionsExpiringSoon"`
      )
      .setParameter('active', SubscriptionStatus.ACTIVE)
      .getRawOne();

    const subscriptionsActive = Number(raw?.subscriptionsActive) || 0;
    const subscriptionsExpiringSoon = Number(raw?.subscriptionsExpiringSoon) || 0;
    return { subscriptionsActive, subscriptionsExpiringSoon };
  }

  async getStats(): Promise<AdminStatsDto> {
    const start = Date.now();
    const CACHE_KEY = 'zonadev:admin:stats:v1';
    const CACHE_TTL_MS = 60_000; // 60 seconds in milliseconds

    // TODO: Cache Invalidation
    // TTL of 60s is a mitigation but not sufficient long-term for critical data.
    // Invalidate 'zonadev:admin:stats:v1' when:
    //   - Subscription changes status       -> SubscriptionService
    //   - Tenant changes active flag         -> TenantService
    //   - User changes active flag           -> UserService
    // Recommended strategy: TypeORM Subscriber or NestJS EventEmitter
    // Example: await this.cache.del('zonadev:admin:stats:v1') after each relevant mutation

    // Try reading from cache
    try {
      const cached = await this.cache.get(CACHE_KEY) as unknown;
      if (this.isValidCache(cached)) {
        this.logger.debug('[AdminStats] Cache hit');
        return cached;
      }
    } catch (err: any) {
      this.logger.warn('[AdminStats] Redis unavailable — fallback to DB', err?.message);
    }

    // Stampede protection: attempt to acquire lock BEFORE executing DB queries
    const LOCK_KEY = 'zonadev:admin:stats:lock';
    const LOCK_TTL = 5; // seconds
    const WAIT_MS = 150; // ms

    const lockValue = randomUUID();
    let lockAcquired = false;
    try {
      const setRes = await this.redisClient.set(LOCK_KEY, lockValue, 'EX', LOCK_TTL, 'NX');
      lockAcquired = setRes === 'OK' || setRes === '1';
    } catch (err: any) {
      this.logger.debug('[AdminStats] Redis lock unavailable — proceeding without lock');
    }

    if (!lockAcquired) {
      // Another process is recalculating — wait and re-check cache
      await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
      try {
        const retried = await this.cache.get(CACHE_KEY) as unknown;
        if (this.isValidCache(retried)) return retried;
      } catch {
        /* ignore */
      }
      // worst-case: proceed to queries
    }

    const [tenantsActive, totalUsers, subscriptionStats] = await Promise.all([
      this.tenantRepo.count({ where: { active: true } }),
      this.userRepo.count({ where: { active: true } }),
      this.getSubscriptionStats(),
    ]);

    const result: AdminStatsDto = {
      tenantsActive,
      totalUsers,
      subscriptionsActive: subscriptionStats.subscriptionsActive,
      subscriptionsExpiringSoon: subscriptionStats.subscriptionsExpiringSoon,
    };

    const duration = Date.now() - start;
    if (duration > 500) this.logger.warn(`[AdminStats] Slow query — ${duration}ms`);

    // Try writing to cache (best-effort)
    try {
      await this.cache.set(CACHE_KEY, result, CACHE_TTL_MS);
    } catch (err: any) {
      this.logger.warn('[AdminStats] Failed to write cache', err?.message);
    }

    // Lock release (only if acquired earlier) using Lua compare-and-delete
    if (lockAcquired) {
      try {
        const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then\n  return redis.call("del", KEYS[1])\nend\nreturn 0`;
        await this.redisClient.eval(lua, 1, LOCK_KEY, lockValue);
      } catch {
        /* ignore */
      }
    }

    return result;
  }
}
