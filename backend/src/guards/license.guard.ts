import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { Role } from '../common/enums/role.enum';

/**
 * Guard de licença — valida subscription ativa.
 * SUPERADMIN (tenant_id = null) é sempre permitido.
 * Aplicar em endpoints que requerem licença válida além de autenticação.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) throw new UnauthorizedException();

    // SUPERADMIN não tem tenant — sempre tem acesso
    if (user.role === Role.SUPERADMIN || !user.tenantId) {
      return true;
    }

    const subscription = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId: user.tenantId })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.expires_at > now()')
      .getOne();

    if (!subscription) {
      throw new UnauthorizedException('Licença inválida ou expirada');
    }

    return true;
  }
}
