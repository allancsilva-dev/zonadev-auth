import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../../entities/plan.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
  ) {}

  findAll() { return this.planRepo.find(); }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  create(dto: Partial<Plan>) { return this.planRepo.save(this.planRepo.create(dto)); }

  async update(id: string, dto: Partial<Plan>): Promise<Plan> {
    await this.findOne(id);
    await this.planRepo.update(id, dto);
    return this.findOne(id);
  }
}
