import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenants1740000000002 implements MigrationInterface {
  name = 'CreateTenants1740000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "plan_type_enum" AS ENUM ('FREE', 'START', 'PRO', 'ENTERPRISE')
    `);

    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name"       VARCHAR(255)        NOT NULL,
        "subdomain"  VARCHAR(100)        NOT NULL,
        "plan"       plan_type_enum      NOT NULL DEFAULT 'FREE',
        "active"     BOOLEAN             NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ         NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ         NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_tenants_subdomain" ON "tenants"("subdomain")
    `);

    await queryRunner.query(`
      CREATE TRIGGER tenants_updated_at
      BEFORE UPDATE ON tenants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TYPE "plan_type_enum"`);
  }
}
