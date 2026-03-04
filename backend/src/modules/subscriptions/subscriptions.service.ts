import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

const ALLOWED_SORT_FIELDS = ['startedAt', 'expiresAt', 'status', 'createdAt'] as const;

export interface SubscriptionListQuery {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  tenantId?: string;
  sort?: string; // field:direction
}

export interface PaginatedSubscriptions {
  data: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async findAll(query?: SubscriptionListQuery): Promise<PaginatedSubscriptions> {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(Math.max(1, query?.limit ?? 25), 100);
    const skip = (page - 1) * pageSize;

    const qb = this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tenant', 'tenant')
      .leftJoinAndSelect('s.plan', 'plan');

    if (query?.tenantId) {
      qb.andWhere('s.tenantId = :tenantId', { tenantId: query.tenantId });
    }

    if (query?.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }

    const [rawField, rawDir] = (query?.sort ?? 'startedAt:desc').split(':');
    const field = (ALLOWED_SORT_FIELDS as readonly string[]).includes(rawField)
      ? rawField
      : 'startedAt';
    const dir = rawDir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(`s.${field}`, dir);

    const [subs, total] = await qb.skip(skip).take(pageSize).getManyAndCount();

    return {
      data: subs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByTenant(tenantId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getActive(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.expiresAt > NOW()')
      .getOne();
  }

  async create(dto: {
    tenantId: string;
    planId: string;
    expiresAt: Date;
  }): Promise<Subscription> {
    try {
      return await this.subscriptionRepo.save(
        this.subscriptionRepo.create({
          tenantId: dto.tenantId,
          planId: dto.planId,
          status: SubscriptionStatus.ACTIVE,
          startedAt: new Date(),
          expiresAt: dto.expiresAt,
        }),
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Tenant já possui uma subscription ativa');
      }
      throw err;
    }
  }

  async cancel(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription não encontrada');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new ConflictException('Subscription já está cancelada');
    }
    sub.status = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepo.save(sub);
  }

  async suspend(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription não encontrada');
    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new ConflictException('Apenas subscriptions ACTIVE podem ser suspensas');
    }
    sub.status = SubscriptionStatus.SUSPENDED;
    return this.subscriptionRepo.save(sub);
  }
}
