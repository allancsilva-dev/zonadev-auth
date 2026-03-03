import { MigrationInterface, QueryRunner } from 'typeorm';

export class authFixes20260303120000 implements MigrationInterface {
  name = 'authFixes20260303120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS aud VARCHAR DEFAULT NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR DEFAULT NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP DEFAULT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS aud;`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS email_verification_token;`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS email_verification_expires;`);
  }
}
