import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokens1700000005 implements MigrationInterface {
  name = 'CreateRefreshTokens1700000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id"     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "token_hash"  VARCHAR(64)  NOT NULL,
        "expires_at"  TIMESTAMPTZ  NOT NULL,
        "revoked_at"  TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_token_hash"
        ON "refresh_tokens"("token_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_user_id"
        ON "refresh_tokens"("user_id")
    `);

    // Índice composto para LRU de sessões:
    // ORDER BY created_at ASC para remover a mais antiga quando ≥ 10 sessões
    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_user_created"
        ON "refresh_tokens"("user_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
