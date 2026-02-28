import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1740000000003 implements MigrationInterface {
  name = 'CreateUsers1740000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "role_enum" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "email"                   VARCHAR(255)    NOT NULL,
        "password_hash"           VARCHAR(255)    NOT NULL,
        "tenant_id"               UUID            REFERENCES tenants(id) ON DELETE RESTRICT,
        "role"                    role_enum       NOT NULL DEFAULT 'USER',
        "token_version"           INTEGER         NOT NULL DEFAULT 1,
        "mfa_secret"              VARCHAR(255),
        "active"                  BOOLEAN         NOT NULL DEFAULT false,
        "password_reset_token"    VARCHAR(255),
        "password_reset_expires"  TIMESTAMPTZ,
        "email_verified_at"       TIMESTAMPTZ,
        "created_at"              TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMPTZ     NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_users_email"
        ON "users"("email")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_password_reset_token"
        ON "users"("password_reset_token")
        WHERE "password_reset_token" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "role_enum"`);
  }
}
