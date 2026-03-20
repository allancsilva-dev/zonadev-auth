import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantRolePermission } from '../entities/tenant-role-permission.entity';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(TenantRolePermission)
    private readonly rpRepo: Repository<TenantRolePermission>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      ctx.getHandler(),
    );

    if (!required?.length) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const jwt = req.user;

    if (jwt?.roles?.includes('SUPERADMIN')) {
      return true;
    }

    const { localUser } = req;
    if (!localUser) {
      return false;
    }

    if (['admin', 'gestor'].includes(localUser.role?.name)) {
      return true;
    }

    const userPerms = await this.rpRepo.find({
      where: { roleId: localUser.roleId },
      relations: ['permission'],
    });

    const slugs = userPerms.map((rp) => rp.permission.slug);
    return required.every((permission) => slugs.includes(permission));
  }
}
