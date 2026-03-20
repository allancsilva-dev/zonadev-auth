import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalUser } from '../entities/local-user.entity';
import { TenantRole } from '../entities/tenant-role.entity';
import { Tenant } from '../entities/tenant.entity';

@Injectable()
export class AutoProvisionGuard implements CanActivate {
  private readonly logger = new Logger(AutoProvisionGuard.name);

  constructor(
    @InjectRepository(LocalUser)
    private readonly localUserRepo: Repository<LocalUser>,
    @InjectRepository(TenantRole)
    private readonly roleRepo: Repository<TenantRole>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const jwt = req.user;

    if (!jwt?.tenantId || typeof jwt.tenantId !== 'string') {
      throw new UnauthorizedException('tenantId ausente ou inválido no token');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: jwt.tenantId } });
    if (!tenant || tenant.provisionStatus !== 'active') {
      this.logger.error({
        event: 'TENANT_NOT_PROVISIONED',
        tenantId: jwt.tenantId,
        status: tenant?.provisionStatus ?? 'not_found',
      });
      throw new ForbiddenException('Tenant não provisionado. Contate o administrador.');
    }

    let localUser = await this.localUserRepo.findOne({
      where: { authUserId: jwt.sub, tenantId: jwt.tenantId },
      relations: ['role'],
    });

    if (!localUser) {
      const roleName = jwt.roles?.includes('SUPERADMIN') ? 'admin' : 'viewer';
      const role = await this.roleRepo.findOne({
        where: { tenantId: jwt.tenantId, name: roleName },
      });

      if (!role) {
        this.logger.error({
          event: 'TENANT_NOT_PROVISIONED',
          tenantId: jwt.tenantId,
          roleName,
        });
        throw new ForbiddenException('Tenant não provisionado. Contate o administrador.');
      }

      localUser = await this.localUserRepo.save({
        authUserId: jwt.sub,
        tenantId: jwt.tenantId,
        roleId: role.id,
        email: jwt.email,
        active: true,
      });

      localUser = await this.localUserRepo.findOneOrFail({
        where: { id: localUser.id },
        relations: ['role'],
      });
    }

    if (localUser.email !== jwt.email) {
      await this.localUserRepo.update(localUser.id, { email: jwt.email });
      localUser.email = jwt.email;
    }

    await this.localUserRepo.update(localUser.id, { lastLoginAt: new Date() });
    req.localUser = localUser;

    return true;
  }
}
