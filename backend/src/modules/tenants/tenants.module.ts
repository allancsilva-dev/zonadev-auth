import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Permission } from '../../entities/permission.entity';
import { TenantRole } from '../../entities/tenant-role.entity';
import { TenantRolePermission } from '../../entities/tenant-role-permission.entity';
import { LocalUser } from '../../entities/local-user.entity';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { SeedTenantService } from './seed-tenant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      Permission,
      TenantRole,
      TenantRolePermission,
      LocalUser,
    ]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, SeedTenantService],
  exports: [TenantsService],
})
export class TenantsModule {}
