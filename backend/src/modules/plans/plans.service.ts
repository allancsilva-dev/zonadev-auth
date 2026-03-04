import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../../entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
  ) {}

  findAll() { return this.planRepo.find({ order: { name: 'ASC' } }); }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  create(dto: CreatePlanDto) { return this.planRepo.save(this.planRepo.create(dto)); }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.planRepo.preload({ id, ...dto });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return this.planRepo.save(plan);
  }
}
