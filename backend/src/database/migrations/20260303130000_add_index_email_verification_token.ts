import { MigrationInterface, QueryRunner } from 'typeorm';

export class addIndexEmailVerificationToken20260303130000 implements MigrationInterface {
  name = 'addIndexEmailVerificationToken20260303130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
      ON users(email_verification_token);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_email_verification_token;
    `);
  }
}
