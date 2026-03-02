import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
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
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('active') active?: string,
    @Query('sort') sort?: string,
    @CurrentUser() user?: any,
  ) {
    // ADMIN: tenantId sempre do JWT — imune a horizontal privilege escalation
    const effectiveTenantId = user?.role === Role.ADMIN ? user.tenantId : undefined;
    return this.usersService.findAll(effectiveTenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      role: role as Role,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      sort,
    });
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  // Soft delete via PATCH — nunca hard delete em IdP
  @Patch(':id/deactivate')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  deactivatePatch(@Param('id') id: string) { return this.usersService.deactivate(id); }

  // Mantido para compatibilidade com código existente — delega para deactivate
  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  deactivate(@Param('id') id: string) { return this.usersService.deactivate(id); }
}
