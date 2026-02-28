import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { Plan } from '../../entities/plan.entity';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll() { return this.plansService.findAll(); }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  create(@Body() dto: Partial<Plan>) { return this.plansService.create(dto); }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<Plan>) {
    return this.plansService.update(id, dto);
  }
}
