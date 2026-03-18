import { MigrationInterface, QueryRunner } from 'typeorm';

export class createAppsSessionsUserAppAccess20260317090000 implements MigrationInterface {
  name = 'createAppsSessionsUserAppAccess20260317090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS apps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        audience VARCHAR(255) NOT NULL UNIQUE,
        allow_origin TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_apps_audience
      ON apps(audience)
      WHERE active = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_apps_slug
      ON apps(slug)
      WHERE active = true
    `);

    await queryRunner.query(`
      INSERT INTO apps (slug, name, audience, allow_origin)
      VALUES
        ('admin', 'ZonaDev Admin', 'auth.zonadev.tech', 'https://auth.zonadev.tech'),
        ('renowa', 'Renowa', 'renowa.zonadev.tech', 'https://renowa.zonadev.tech'),
        ('erp', 'ERP Nexos', 'erp.zonadev.tech', 'https://erp.zonadev.tech')
      ON CONFLICT (slug) DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT sessions_not_expired CHECK (expires_at > created_at)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user
      ON sessions(user_id)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires
      ON sessions(expires_at)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_app_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_id UUID NOT NULL REFERENCES apps(id),
        default_role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        granted_by UUID REFERENCES users(id),
        revoked_at TIMESTAMPTZ,
        UNIQUE(user_id, app_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_uaa_user
      ON user_app_access(user_id)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_uaa_app
      ON user_app_access(app_id)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO user_app_access (user_id, app_id, default_role, status)
      SELECT u.id, a.id, 'admin', 'active'
      FROM users u
      JOIN apps a ON a.slug = 'admin'
      WHERE u.roles @> ARRAY['SUPERADMIN']
      ON CONFLICT (user_id, app_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO user_app_access (user_id, app_id, default_role, status)
      SELECT u.id, a.id, 'viewer', 'active'
      FROM users u
      JOIN apps a ON a.slug = 'renowa'
      WHERE u.tenant_id IS NOT NULL
      ON CONFLICT (user_id, app_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO user_app_access (user_id, app_id, default_role, status)
      SELECT u.id, a.id, 'viewer', 'active'
      FROM users u
      JOIN apps a ON a.slug = 'erp'
      WHERE u.tenant_id IS NOT NULL
      ON CONFLICT (user_id, app_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_app_access`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS apps`);
  }
}
