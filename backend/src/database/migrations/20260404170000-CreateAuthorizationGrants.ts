import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthorizationGrants20260404170000 implements MigrationInterface {
  name = 'CreateAuthorizationGrants20260404170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE authorization_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        scopes JSONB NOT NULL DEFAULT '[]',
        revoked_at TIMESTAMPTZ,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_grants_user_client
      ON authorization_grants(user_id, client_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_grants_active
      ON authorization_grants(user_id, client_id)
      WHERE revoked_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS authorization_grants CASCADE`);
  }
}