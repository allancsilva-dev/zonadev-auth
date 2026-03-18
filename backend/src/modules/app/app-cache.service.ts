import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from '../../entities/app.entity';

@Injectable()
export class AppCacheService implements OnModuleInit {
  private readonly logger = new Logger(AppCacheService.name);

  private appsByAudience = new Map<string, App>();
  private allowedOrigins = new Set<string>();

  constructor(
    @InjectRepository(App)
    private readonly appRepo: Repository<App>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    setInterval(() => {
      this.reload().catch((err) => {
        this.logger.error(`Falha ao recarregar cache de apps: ${err}`);
      });
    }, 5 * 60 * 1000);
  }

  async reload(): Promise<void> {
    const apps = await this.appRepo.find({ where: { active: true } });

    const byAudience = new Map<string, App>();
    const origins = new Set<string>();

    for (const app of apps) {
      byAudience.set(app.audience, app);
      origins.add(app.allowOrigin);
    }

    this.appsByAudience = byAudience;
    this.allowedOrigins = origins;

    this.logger.log(`Cache de apps recarregado (${apps.length} apps ativas)`);
  }

  isValidAudience(aud: string): boolean {
    return this.appsByAudience.has(aud);
  }

  isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.has(origin);
  }

  getAppByAudience(aud: string): App | undefined {
    return this.appsByAudience.get(aud);
  }

  getAppBySlug(slug: string): App | undefined {
    for (const app of this.appsByAudience.values()) {
      if (app.slug === slug) return app;
    }
    return undefined;
  }

  getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }
}
