import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, And, LessThan } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async getStats() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [tenantsActive, totalUsers, subscriptionsActive, subscriptionsExpiringSoon] =
      await Promise.all([
        this.tenantRepo.count({ where: { active: true } }),
        this.userRepo.count(),
        this.subscriptionRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
        this.subscriptionRepo.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
            expiresAt: And(MoreThan(now), LessThan(thirtyDaysFromNow)),
          },
        }),
      ]);

    return { tenantsActive, totalUsers, subscriptionsActive, subscriptionsExpiringSoon };
  }
}
