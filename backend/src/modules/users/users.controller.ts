import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../strategies/jwt.strategy';

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
    @CurrentUser() user?: JwtPayload,
  ) {
    // ADMIN: tenantId sempre do JWT — imune a horizontal privilege escalation
    const effectiveTenantId = user?.roles?.includes(Role.ADMIN) ? (user.tenantId ?? undefined) : undefined;
    return this.usersService.findAll(effectiveTenantId, {
      page: Number(page) > 0 ? Number(page) : undefined,
      limit: Number(limit) > 0 ? Number(limit) : undefined,
      search,
      role: Object.values(Role).includes(role as Role) ? (role as Role) : undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      sort,
    });
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) { return this.usersService.findOne(id, user); }

  @Post()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) { return this.usersService.create(dto, (user.roles?.[0] as Role) ?? Role.USER, user.tenantId ?? null); }

  // Soft delete via PATCH — nunca hard delete em IdP
  @Patch(':id/deactivate')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  deactivatePatch(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtPayload) { return this.usersService.deactivate(id, user); }

  // Mantido para compatibilidade com código existente — delega para deactivate
  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtPayload) { return this.usersService.deactivate(id, user); }
}
