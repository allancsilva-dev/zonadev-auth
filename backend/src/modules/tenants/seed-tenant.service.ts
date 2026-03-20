import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { TenantRole } from '../../entities/tenant-role.entity';
import { TenantRolePermission } from '../../entities/tenant-role-permission.entity';
import { LocalUser } from '../../entities/local-user.entity';

@Injectable()
export class SeedTenantService {
  private readonly logger = new Logger(SeedTenantService.name);

  constructor(private readonly dataSource: DataSource) {}

  async seedTenant(
    tenantId: string,
    ownerAuthUserId: string,
    ownerEmail: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const permRepo = manager.getRepository(Permission);
      const roleRepo = manager.getRepository(TenantRole);
      const rolePermRepo = manager.getRepository(TenantRolePermission);
      const localUserRepo = manager.getRepository(LocalUser);

      const allPerms = await permRepo.find();
      const viewerPerms = allPerms.filter((p) => p.slug.endsWith('.ver'));

      const adminRole = await roleRepo.save({ tenantId, name: 'admin' });
      if (allPerms.length > 0) {
        await rolePermRepo.save(
          allPerms.map((perm) => ({ roleId: adminRole.id, permissionId: perm.id })),
        );
      }

      const viewerRole = await roleRepo.save({ tenantId, name: 'viewer' });
      if (viewerPerms.length > 0) {
        await rolePermRepo.save(
          viewerPerms.map((perm) => ({ roleId: viewerRole.id, permissionId: perm.id })),
        );
      }

      await localUserRepo.save({
        authUserId: ownerAuthUserId,
        tenantId,
        roleId: adminRole.id,
        email: ownerEmail,
        active: true,
      });
    });

    this.logger.log({ event: 'TENANT_SEEDED', tenantId });
  }
}
