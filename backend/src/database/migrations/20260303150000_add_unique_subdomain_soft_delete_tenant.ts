import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUniqueSubdomainSoftDeleteTenant1740963600000 implements MigrationInterface {
  name = 'addUniqueSubdomainSoftDeleteTenant1740963600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenants_subdomain
      ON tenants(subdomain);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uniq_tenants_subdomain;
    `);
  }
}
