import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostLogoutRedirectUris implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "post_logout_redirect_uris" text[]`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "apps" DROP COLUMN IF EXISTS "post_logout_redirect_uris"`);
  }
}
