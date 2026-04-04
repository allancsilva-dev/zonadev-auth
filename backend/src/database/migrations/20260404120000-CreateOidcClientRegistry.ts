import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOidcClientRegistry20260404120000 implements MigrationInterface {
  name = 'CreateOidcClientRegistry20260404120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR(100) NOT NULL UNIQUE
          CHECK (client_id ~ '^[a-z0-9-]+$'),
        client_secret_hash VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        back_channel_logout_uri VARCHAR(500),
        grant_types JSONB NOT NULL DEFAULT '["authorization_code", "refresh_token"]',
        allowed_scopes JSONB NOT NULL DEFAULT '["openid", "profile", "email"]',
        access_token_ttl INTEGER NOT NULL DEFAULT 900,
        refresh_token_ttl INTEGER NOT NULL DEFAULT 604800,
        max_sessions_per_user INTEGER NOT NULL DEFAULT 10,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_redirect_uris (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        uri_type VARCHAR(10) NOT NULL CHECK (uri_type IN ('login', 'logout')),
        uri VARCHAR(500) NOT NULL,
        CONSTRAINT uq_client_uri UNIQUE (client_id, uri_type, uri)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_active
      ON clients(active)
      WHERE active = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_redirect_uris_lookup
      ON client_redirect_uris(client_id, uri_type, uri)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_redirect_uris_lookup`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_client_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_redirect_uris`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients`);
  }
}