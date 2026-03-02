import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { subdomain } });
  }

  async findUsers(
    tenantId: string,
    query?: { page?: number; limit?: number; search?: string; sort?: string },
  ) {
    await this.findOne(tenantId); // valida existência

    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(Math.max(1, query?.limit ?? 25), 100);
    const skip = (page - 1) * pageSize;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId });

    if (query?.search) {
      qb.andWhere('u.email ILIKE :search', { search: `%${query.search}%` });
    }

    const [rawField, rawDir] = (query?.sort ?? 'createdAt:desc').split(':');
    const field = ['createdAt', 'email', 'role'].includes(rawField) ? rawField : 'createdAt';
    const dir = rawDir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(`u.${field}`, dir);

    const [users, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
    const data = users.map(({ passwordHash: _, ...u }) => u);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.findBySubdomain(dto.subdomain);
    if (existing) throw new ConflictException('Subdomínio já está em uso');
    return this.tenantRepo.save(this.tenantRepo.create(dto));
  }

  async update(id: string, dto: Partial<CreateTenantDto>): Promise<Tenant> {
    await this.findOne(id);
    await this.tenantRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.tenantRepo.delete(id);
  }
}
