import { MigrationInterface, QueryRunner } from 'typeorm';

export class createIndexesAdminStats20260303 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_subscription_status
        ON subscription(status);

      CREATE INDEX IF NOT EXISTS idx_subscription_status_expires
        ON subscription(status, expires_at);

      CREATE INDEX IF NOT EXISTS idx_user_active
        ON "user"(active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_subscription_status_expires;
      DROP INDEX IF EXISTS idx_subscription_status;
      DROP INDEX IF EXISTS idx_user_active;
    `);
  }
}
