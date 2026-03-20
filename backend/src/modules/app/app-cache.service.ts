import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from '../../entities/app.entity';

@Injectable()
export class AppCacheService implements OnModuleInit {
  private readonly logger = new Logger(AppCacheService.name);

  private cacheByAudience = new Map<string, App>();
  private cacheBySlug = new Map<string, App>();
  private allowedOrigins = new Set<string>();
  private expiresAt = 0;
  private readonly ttlMs = 60_000;
  private reloadingPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(App)
    private readonly appRepo: Repository<App>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reloadFromDatabase();
  }

  async reloadFromDatabase(): Promise<void> {
    if (this.reloadingPromise) {
      return this.reloadingPromise;
    }

    this.reloadingPromise = this.doReload().finally(() => {
      this.reloadingPromise = null;
    });

    return this.reloadingPromise;
  }

  async reload(): Promise<void> {
    await this.reloadFromDatabase();
  }

  async getByAudience(aud: string): Promise<App | undefined> {
    if (Date.now() > this.expiresAt) {
      await this.reloadFromDatabase();
    }

    return this.cacheByAudience.get(this.normalize(aud));
  }

  getAppByAudience(aud: string): App | undefined {
    return this.cacheByAudience.get(this.normalize(aud));
  }

  getAppBySlug(slug: string): App | undefined {
    return this.cacheBySlug.get(this.normalize(slug));
  }

  isLoaded(): boolean {
    return this.cacheByAudience.size > 0;
  }

  isValidAudience(aud: string): boolean {
    return this.cacheByAudience.has(this.normalize(aud));
  }

  isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.has(this.normalizeOrigin(origin));
  }

  getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }

  private async doReload(): Promise<void> {
    const apps = await this.appRepo.find({ where: { active: true } });

    const byAudience = new Map<string, App>();
    const bySlug = new Map<string, App>();
    const origins = new Set<string>();

    for (const app of apps) {
      const audienceKey = this.normalize(app.domain ?? app.audience);
      if (audienceKey) {
        byAudience.set(audienceKey, app);
      }

      const slugKey = this.normalize(app.slug);
      if (slugKey) {
        bySlug.set(slugKey, app);
      }

      const originCandidate = app.baseUrl ?? app.allowOrigin;
      if (originCandidate) {
        origins.add(this.normalizeOrigin(originCandidate));
      }
    }

    this.cacheByAudience = byAudience;
    this.cacheBySlug = bySlug;
    this.allowedOrigins = origins;
    this.expiresAt = Date.now() + this.ttlMs;

    this.logger.log(`[AppCache] Recarregado — ${apps.length} apps ativas`);
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toLowerCase().trim();
  }

  private normalizeOrigin(value: string): string {
    try {
      return new URL(value).origin.toLowerCase();
    } catch {
      return this.normalize(value);
    }
  }
}
