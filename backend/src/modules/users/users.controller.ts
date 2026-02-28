import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findAll(@Query('tenantId') tenantId: string, @CurrentUser() user: any) {
    // ADMIN só vê usuários do próprio tenant
    const effectiveTenantId = user.role === Role.ADMIN ? user.tenantId : tenantId;
    return this.usersService.findAll(effectiveTenantId);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  deactivate(@Param('id') id: string) { return this.usersService.deactivate(id); }
}
