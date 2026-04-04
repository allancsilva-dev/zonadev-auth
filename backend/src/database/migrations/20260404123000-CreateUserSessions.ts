import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSessions20260404123000 implements MigrationInterface {
  name = 'CreateUserSessions20260404123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        refresh_token_id UUID,
        refresh_token_family_id UUID,
        revoked_at TIMESTAMPTZ,
        revoke_reason VARCHAR(50),
        user_agent TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_client
      ON user_sessions(user_id, client_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active
      ON user_sessions(user_id, client_id)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_lru
      ON user_sessions(user_id, client_id, created_at ASC)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_family
      ON user_sessions(refresh_token_family_id)
      WHERE refresh_token_family_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_sessions CASCADE`);
  }
}