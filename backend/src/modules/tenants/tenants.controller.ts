import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ReprovisionTenantDto } from './dto/reprovision-tenant.dto';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { SuperAdminGuard } from '../../guards/superadmin.guard';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() { return this.tenantsService.findAll(); }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) { return this.tenantsService.findOne(id); }

  @Get(':id/users')
  findUsers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.tenantsService.findUsers(id, {
      page: Number(page) > 0 ? Number(page) : undefined,
      limit: Number(limit) > 0 ? Number(limit) : undefined,
      search,
      sort,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() dto: CreateTenantDto) { return this.tenantsService.createTenant(dto); }

  @Post(':id/reprovision')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reprovision(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReprovisionTenantDto,
  ) {
    return this.tenantsService.reprovisionTenant(id, dto);
  }

  @Put(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) { return this.tenantsService.remove(id); }
}
