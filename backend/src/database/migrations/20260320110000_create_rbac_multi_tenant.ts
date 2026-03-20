import { MigrationInterface, QueryRunner } from 'typeorm';

export class createRbacMultiTenant20260320110000 implements MigrationInterface {
  name = 'createRbacMultiTenant20260320110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) NOT NULL UNIQUE,
        module VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_tenant_roles_tenant_name UNIQUE (tenant_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant
      ON tenant_roles(tenant_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_role_permissions (
        role_id UUID NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY(role_id, permission_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_role_perms_role
      ON tenant_role_permissions(role_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS local_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_user_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        role_id UUID NOT NULL REFERENCES tenant_roles(id),
        email VARCHAR(255) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        provisioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ,
        CONSTRAINT uq_local_users_auth_tenant UNIQUE (auth_user_id, tenant_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_local_users_tenant
      ON local_users(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_local_users_auth
      ON local_users(auth_user_id)
    `);

    await queryRunner.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS provision_status VARCHAR(20) NOT NULL DEFAULT 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS provision_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS local_users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions`);
  }
}
