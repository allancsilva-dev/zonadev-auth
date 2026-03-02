import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('sort') sort?: string,
    @CurrentUser() user?: any,
  ) {
    // ADMIN: tenantId sempre do JWT — imune a horizontal privilege escalation
    const effectiveTenantId = user?.role === Role.ADMIN ? user.tenantId : tenantId;
    return this.subscriptionsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as SubscriptionStatus,
      tenantId: effectiveTenantId,
      sort,
    });
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
