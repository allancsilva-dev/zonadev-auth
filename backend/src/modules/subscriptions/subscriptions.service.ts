import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async findByTenant(tenantId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getActive(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.expires_at > now()')
      .getOne();
  }

  async create(dto: {
    tenantId: string;
    planId: string;
    expiresAt: Date;
  }): Promise<Subscription> {
    // Verifica se já existe subscription ACTIVE para este tenant
    const existing = await this.getActive(dto.tenantId);
    if (existing) {
      throw new ConflictException('Tenant já possui uma subscription ativa');
    }

    return this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        tenantId: dto.tenantId,
        planId: dto.planId,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
        expiresAt: dto.expiresAt,
      }),
    );
  }

  async cancel(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription não encontrada');
    await this.subscriptionRepo.update(id, { status: SubscriptionStatus.CANCELLED });
    return this.subscriptionRepo.findOne({ where: { id } }) as Promise<Subscription>;
  }

  async suspend(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription não encontrada');
    await this.subscriptionRepo.update(id, { status: SubscriptionStatus.SUSPENDED });
    return this.subscriptionRepo.findOne({ where: { id } }) as Promise<Subscription>;
  }
}
