import { MigrationInterface, QueryRunner } from 'typeorm';

export class createIndexesAdminStats1740960000000 implements MigrationInterface {
  name = 'createIndexesAdminStats1740960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_subscription_status
        ON subscriptions(status);

      CREATE INDEX IF NOT EXISTS idx_subscription_status_expires
        ON subscriptions(status, expires_at);

      CREATE INDEX IF NOT EXISTS idx_user_active
        ON users(active);
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
