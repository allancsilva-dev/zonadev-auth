import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueActiveSubscriptionPerTenant20260303140000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_one_active_per_tenant ON subscriptions(tenant_id) WHERE status = 'ACTIVE';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscription_one_active_per_tenant;`);
  }
}
