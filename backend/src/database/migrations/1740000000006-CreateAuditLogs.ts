import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1740000000006 implements MigrationInterface {
  name = 'CreateAuditLogs1740000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM (
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGIN_BLOCKED_EMAIL_NOT_VERIFIED',
        'LOGOUT',
        'LICENSE_EXPIRED',
        'TOKEN_REFRESHED',
        'PASSWORD_RESET',
        'TOKEN_REUSE_DETECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "tenant_id"   UUID,
        "user_id"     UUID,
        "action"      audit_action_enum NOT NULL,
        "ip_address"  VARCHAR(45)       NOT NULL DEFAULT '',
        "user_agent"  VARCHAR(512)      NOT NULL DEFAULT '',
        "created_at"  TIMESTAMPTZ       NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_tenant_id" ON "audit_logs"("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "audit_action_enum"`);
  }
}
