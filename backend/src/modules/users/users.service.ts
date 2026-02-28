import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(tenantId?: string): Promise<Omit<User, 'passwordHash'>[]> {
    const where = tenantId ? { tenantId } : {};
    const users = await this.userRepo.find({ where, order: { createdAt: 'DESC' } });
    return users.map(({ passwordHash, ...u }) => u as any);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
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

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    // ADMIN e USER precisam de tenantId
    if (dto.role && dto.role !== Role.SUPERADMIN && !dto.tenantId) {
      throw new BadRequestException('tenantId obrigatório para ADMIN e USER');
    }

    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcryptjs.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      tenantId: dto.tenantId ?? null,
      role: dto.role ?? Role.USER,
      active: dto.active ?? false, // inicia inativo — verificação de e-mail
      tokenVersion: 1,
    });

    const saved = await this.userRepo.save(user);
    const { passwordHash: _, ...result } = saved;
    return result as any;
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    await this.userRepo.update(id, data);
  }

  async deactivate(id: string): Promise<void> {
    await this.findOne(id);
    await this.userRepo.update(id, { active: false });
  }
}
