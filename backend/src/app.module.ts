import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { HealthModule } from './modules/health/health.module';
import { CleanupJob } from './jobs/cleanup.job';

import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    // Config global
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, User, Plan, Subscription, RefreshToken, AuditLog],
      synchronize: false, // Nunca synchronize em produção — usar migrations
      logging: process.env.NODE_ENV === 'development',
    }),

    // Rate limiting global — cada endpoint pode sobrescrever com @Throttle()
    // IMPORTANTE: usa memória local por instância.
    // Em deploy multi-instância (Docker Swarm, K8s), o limite é por processo.
    // Migração futura: @nestjs-modules/throttler-storage-redis
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 minuto (padrão, endpoints sobrescrevem)
        limit: 60,
      },
    ]),

    // Jobs agendados (cleanup diário)
    ScheduleModule.forRoot(),

    // Módulos de funcionalidade
    AuthModule,
    TenantsModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    HealthModule,

    // CleanupJob precisa do RefreshToken via TypeORM
    TypeOrmModule.forFeature([RefreshToken]),
  ],
  providers: [
    CleanupJob,
    // ThrottlerGuard aplicado globalmente — @Throttle() nos endpoints sobrescreve
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
