import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findByTenant(@Query('tenantId') tenantId: string) {
    return this.subscriptionsService.findByTenant(tenantId);
  }

  @Post()
  create(@Body() dto: { tenantId: string; planId: string; expiresAt: string }) {
    return this.subscriptionsService.create({
      ...dto,
      expiresAt: new Date(dto.expiresAt),
    });
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) { return this.subscriptionsService.cancel(id); }

  @Put(':id/suspend')
  suspend(@Param('id') id: string) { return this.subscriptionsService.suspend(id); }
}
