import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlans1740000000001 implements MigrationInterface {
  name = 'CreatePlans1740000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name"       VARCHAR(100)        NOT NULL,
        "price"      DECIMAL(10,2)       NOT NULL DEFAULT 0,
        "max_users"  INTEGER             NOT NULL DEFAULT 5,
        "features"   JSONB               NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ         NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ         NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER plans_updated_at
      BEFORE UPDATE ON plans
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
