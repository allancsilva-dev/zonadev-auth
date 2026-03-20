import { MigrationInterface, QueryRunner } from 'typeorm';

export class appsProductionHardening20260320111000 implements MigrationInterface {
  name = 'appsProductionHardening20260320111000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE apps
      ADD COLUMN IF NOT EXISTS domain VARCHAR(255)
    `);

    await queryRunner.query(`
      ALTER TABLE apps
      ADD COLUMN IF NOT EXISTS base_url TEXT
    `);

    await queryRunner.query(`
      UPDATE apps
      SET
        domain = lower(trim(COALESCE(domain, audience))),
        slug = lower(trim(slug)),
        base_url = lower(trim(COALESCE(base_url, allow_origin)))
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_domain
      ON apps(domain)
      WHERE domain IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_slug
      ON apps(slug)
    `);

    await queryRunner.query(`
      ALTER TABLE apps
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS apps_updated_at ON apps;
      CREATE TRIGGER apps_updated_at
      BEFORE UPDATE ON apps
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);

    await queryRunner.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS provision_status VARCHAR(20) NOT NULL DEFAULT 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS apps_updated_at ON apps`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at`);
    await queryRunner.query(`ALTER TABLE apps DROP COLUMN IF EXISTS updated_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_apps_domain`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_apps_slug`);
    await queryRunner.query(`ALTER TABLE apps DROP COLUMN IF EXISTS base_url`);
    await queryRunner.query(`ALTER TABLE apps DROP COLUMN IF EXISTS domain`);
  }
}
