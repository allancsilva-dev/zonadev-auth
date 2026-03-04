import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../strategies/jwt.strategy';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

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
    @CurrentUser() user?: JwtPayload,
  ) {
    // ADMIN: tenantId sempre do JWT — imune a horizontal privilege escalation
    const effectiveTenantId = user?.role === Role.ADMIN ? (user.tenantId ?? undefined) : tenantId;
    return this.subscriptionsService.findAll({
      page: Number(page) > 0 ? Number(page) : undefined,
      limit: Number(limit) > 0 ? Number(limit) : undefined,
      status: status as SubscriptionStatus,
      tenantId: effectiveTenantId,
      sort,
    });
  }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const effectiveTenantId = user.role === Role.ADMIN ? user.tenantId : dto.tenantId;

    if (!effectiveTenantId) {
      throw new BadRequestException('tenantId é obrigatório');
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt deve ser uma data futura');
    }

    return this.subscriptionsService.create({
      tenantId: effectiveTenantId,
      planId: dto.planId,
      expiresAt,
    });
  }

  @Put(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) { return this.subscriptionsService.cancel(id); }

  @Put(':id/suspend')
  suspend(@Param('id', new ParseUUIDPipe()) id: string) { return this.subscriptionsService.suspend(id); }
}
