import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import type { JwtPayload } from '../../strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;
const ALLOWED_SORT_FIELDS = ['createdAt', 'email', 'role'] as const;

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  active?: boolean;
  sort?: string; // field:direction
}

export interface PaginatedUsers {
  data: Omit<User, 'passwordHash'>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(tenantId?: string, query?: UserListQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(Math.max(1, query?.limit ?? 25), 100);
    const skip = (page - 1) * pageSize;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.tenant', 'tenant');

    if (tenantId) {
      qb.andWhere('u.tenantId = :tenantId', { tenantId });
    }

    if (query?.search) {
      qb.andWhere('u.email ILIKE :search', { search: `%${query.search}%` });
    }

    if (query?.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }

    if (query?.active !== undefined) {
      qb.andWhere('u.active = :active', { active: query.active });
    }

    // Sort seguro — whitelist de campos permitidos
    const [rawField, rawDir] = (query?.sort ?? 'createdAt:desc').split(':');
    const field = (ALLOWED_SORT_FIELDS as readonly string[]).includes(rawField)
      ? rawField
      : 'createdAt';
    const dir = rawDir === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(`u.${field}`, dir);

    const [users, total] = await qb.skip(skip).take(pageSize).getManyAndCount();

    const data = users.map(({ passwordHash: _, ...u }) => u as Omit<User, 'passwordHash'>);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, currentUser?: JwtPayload): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['tenant'] });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (currentUser?.role === Role.ADMIN && user.tenantId !== currentUser.tenantId) {
      throw new ForbiddenException('Acesso negado');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['tenant'],
    });
  }

  async findByResetToken(tokenHash: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { passwordResetToken: tokenHash } });
  }

  async create(
    dto: CreateUserDto,
    creatorRole: Role,
    creatorTenantId: string | null,
  ): Promise<Omit<User, 'passwordHash'>> {
    const finalRole = dto.role ?? Role.USER;

    // ADMIN sempre usa o próprio tenantId — nunca confia no body
    if (creatorRole === Role.ADMIN) {
      dto.tenantId = creatorTenantId ?? undefined;
    }

    // ADMIN não pode criar SUPERADMIN
    if (creatorRole === Role.ADMIN && finalRole === Role.SUPERADMIN) {
      throw new BadRequestException('ADMIN não pode criar utilizadores SUPERADMIN');
    }

    // Non-SUPERADMIN sem tenantId é inválido
    if (finalRole !== Role.SUPERADMIN && !dto.tenantId) {
      throw new BadRequestException('tenantId obrigatório para ADMIN e USER');
    }

    const passwordHash = await bcryptjs.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      tenantId: dto.tenantId ?? null,
      role: finalRole,
      active: dto.active ?? false, // inicia inativo — verificação de e-mail
      tokenVersion: 1,
    });

    try {
      const saved = await this.userRepo.save(user);
      const { passwordHash: _, ...result } = saved;
      return result as Omit<User, 'passwordHash'>;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw err;
    }
  }

  async update(
    id: string,
    data: Partial<Pick<User,
      | 'active'
      | 'emailVerifiedAt'
      | 'tokenVersion'
      | 'passwordHash'
      | 'passwordResetToken'
      | 'passwordResetExpires'
      | 'emailVerificationToken'
      | 'emailVerificationExpires'
    >>,
  ): Promise<void> {
    await this.userRepo.update(id, data as any);
  }

  async deactivate(id: string, currentUser?: JwtPayload): Promise<void> {
    const user = await this.findOne(id, currentUser);
    if (!user.active) {
      throw new ConflictException('Utilizador já está inactivo');
    }
    await this.userRepo.update(id, { active: false });
  }
}
