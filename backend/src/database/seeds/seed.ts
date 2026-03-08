import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Plan } from '../../entities/plan.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Role } from '../../common/enums/role.enum';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

const BCRYPT_ROUNDS = 12;

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Tenant, User, Plan, Subscription],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Conectado ao banco de dados');

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD não definido no .env');
  }

  // ─── Plano FREE ────────────────────────────────────────────────────────────
  const planRepo = dataSource.getRepository(Plan);
  let plan = await planRepo.findOne({ where: { name: 'FREE' } });

  if (!plan) {
    plan = await planRepo.save(
      planRepo.create({
        name: 'FREE',
        price: 0,
        maxUsers: 5,
        features: {
          multiTenant: false,
          sso: false,
          auditLog: false,
          support: 'community',
        },
      }),
    );
    console.log(`✅ Plano FREE criado: ${plan.id}`);
  } else {
    console.log(`⏭️  Plano FREE já existe: ${plan.id}`);
  }

  // ─── Tenant ZonaDev ────────────────────────────────────────────────────────
  const tenantRepo = dataSource.getRepository(Tenant);
  let tenant = await tenantRepo.findOne({ where: { subdomain: 'zonadev' } });

  if (!tenant) {
    tenant = await tenantRepo.save(
      tenantRepo.create({
        name: 'ZonaDev',
        subdomain: 'zonadev',
        plan: PlanType.ENTERPRISE,
        active: true,
      }),
    );
    console.log(`✅ Tenant ZonaDev criado: ${tenant.id}`);
  } else {
    console.log(`⏭️  Tenant ZonaDev já existe: ${tenant.id}`);
  }

  // ─── Subscription (100 anos — dono da plataforma não expira) ──────────────
  const subscriptionRepo = dataSource.getRepository(Subscription);
  const existingSub = await subscriptionRepo.findOne({
    where: { tenantId: tenant.id, status: SubscriptionStatus.ACTIVE },
  });

  if (!existingSub) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 100); // now() + 100 years

    await subscriptionRepo.save(
      subscriptionRepo.create({
        tenantId: tenant.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
        expiresAt,
      }),
    );
    console.log(`✅ Subscription ACTIVE criada (expira: ${expiresAt.toISOString()})`);
  } else {
    console.log(`⏭️  Subscription já existe para o tenant ZonaDev`);
  }

  // ─── SUPERADMIN ────────────────────────────────────────────────────────────
  const userRepo = dataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { email: 'admin@zonadev.tech' } });

  if (!existing) {
    const passwordHash = await bcryptjs.hash(adminPassword, BCRYPT_ROUNDS);

    await userRepo.save(
      userRepo.create({
        email: 'admin@zonadev.tech',
        passwordHash,
        tenantId: null,       // SUPERADMIN não pertence a tenant
        roles: [Role.SUPERADMIN],
        active: true,
        tokenVersion: 1,
        emailVerifiedAt: new Date(), // SUPERADMIN não precisa verificar e-mail
      }),
    );
    console.log('✅ SUPERADMIN criado: admin@zonadev.tech');
  } else {
    console.log('⏭️  SUPERADMIN já existe: admin@zonadev.tech');
  }

  await dataSource.destroy();
  console.log('\n🎉 Seed concluído com sucesso!');
}

seed().catch((err) => {
  console.error('❌ Falha no seed:', err);
  process.exit(1);
});
