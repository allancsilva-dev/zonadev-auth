import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1740000000004 implements MigrationInterface {
  name = 'CreateSubscriptions1740000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "subscription_status_enum"
        AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "tenant_id"  UUID            NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        "plan_id"    UUID            NOT NULL REFERENCES plans(id)   ON DELETE RESTRICT,
        "status"     subscription_status_enum NOT NULL DEFAULT 'ACTIVE',
        "started_at" TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ     NOT NULL,
        "created_at" TIMESTAMPTZ     NOT NULL DEFAULT now()
      )
    `);

    // Índice composto cobrindo o padrão exato de consulta no login:
    // WHERE tenant_id = ? AND status = 'ACTIVE' AND expires_at > now()
    await queryRunner.query(`
      CREATE INDEX "idx_subscriptions_lookup"
        ON "subscriptions"("tenant_id", "status", "expires_at")
    `);

    // Garante que cada tenant tenha no máximo UMA subscription ACTIVE simultânea.
    // Índice parcial: constraint só se aplica onde status = 'ACTIVE',
    // permitindo histórico normal de subscriptions canceladas ou suspensas.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_unique_active_subscription"
        ON "subscriptions"("tenant_id")
        WHERE "status" = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "subscription_status_enum"`);
  }
}
