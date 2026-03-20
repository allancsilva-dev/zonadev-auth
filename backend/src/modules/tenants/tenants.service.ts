import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SeedTenantService } from './seed-tenant.service';
import { ReprovisionTenantDto } from './dto/reprovision-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly seedTenantService: SeedTenantService,
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

  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    if (!dto.ownerEmail || !dto.ownerEmail.includes('@')) {
      throw new BadRequestException('ownerEmail inválido');
    }

    const existing = await this.tenantRepo.findOne({ where: { subdomain: dto.subdomain } });
    if (existing) {
      throw new ConflictException(`Tenant com slug '${dto.subdomain}' já existe`);
    }

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        name: dto.name,
        subdomain: dto.subdomain,
        plan: dto.plan,
        active: dto.active,
        provisionStatus: 'pending',
      }),
    );

    try {
      await this.seedTenantService.seedTenant(
        tenant.id,
        dto.ownerAuthUserId,
        dto.ownerEmail,
      );

      await this.tenantRepo.update(tenant.id, { provisionStatus: 'active' });
      this.logger.log({ event: 'TENANT_PROVISIONED', tenantId: tenant.id });
    } catch (error) {
      await this.tenantRepo.update(tenant.id, { provisionStatus: 'failed' });

      const err = error as { message?: string };
      this.logger.error({
        event: 'TENANT_PROVISION_FAILED',
        tenantId: tenant.id,
        error: err.message ?? 'unknown_error',
      });
    }

    return this.tenantRepo.findOneOrFail({ where: { id: tenant.id } });
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    try {
      return await this.createTenant(dto);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Dados duplicados — verifique os campos únicos');
      }
      throw err;
    }
  }

  async reprovisionTenant(id: string, dto: ReprovisionTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (tenant.provisionStatus !== 'failed') {
      throw new BadRequestException('Apenas tenants com status failed podem ser re-provisionados');
    }

    if (!dto.ownerEmail || !dto.ownerEmail.includes('@')) {
      throw new BadRequestException('ownerEmail inválido');
    }

    try {
      await this.seedTenantService.seedTenant(id, dto.ownerAuthUserId, dto.ownerEmail);
      await this.tenantRepo.update(id, { provisionStatus: 'active' });
      this.logger.log({ event: 'TENANT_PROVISIONED', tenantId: id });
    } catch (error) {
      await this.tenantRepo.update(id, { provisionStatus: 'failed' });
      const err = error as { message?: string };
      this.logger.error({
        event: 'TENANT_PROVISION_FAILED',
        tenantId: id,
        error: err.message ?? 'unknown_error',
      });
    }

    return this.tenantRepo.findOneOrFail({ where: { id } });
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepo.preload({ id, ...dto });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    try {
      return await this.tenantRepo.save(tenant);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Subdomínio já está em uso');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    if (!tenant.active) {
      throw new ConflictException('Tenant já está inactivo');
    }
    await this.tenantRepo.update(id, { active: false });
  }
}
