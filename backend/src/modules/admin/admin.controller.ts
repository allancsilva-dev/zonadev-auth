import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Post,
  Param,
  Body,
  Patch,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AdminStatsDto } from './dto/admin-stats.dto';
import { ManageAppAccessDto } from './dto/manage-app-access.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../strategies/jwt.strategy';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Stats agregadas — calculadas no backend, nunca no frontend
  @Get('stats')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  getStats(): Promise<AdminStatsDto> {
    return this.adminService.getStats();
  }

  @Post('users/:id/kill-sessions')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  killSessions(@Param('id') userId: string) {
    return this.adminService.killSessions(userId);
  }

  @Get('users/:id/app-access')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  getAppAccess(@Param('id') userId: string) {
    return this.adminService.getAppAccess(userId);
  }

  @Post('users/:id/app-access')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  manageAppAccess(
    @Param('id') userId: string,
    @Body() dto: ManageAppAccessDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.manageAppAccess(userId, dto, admin);
  }

  @Get('apps')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  listApps() {
    return this.adminService.listApps();
  }

  @Post('apps')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  createApp(@Body() dto: CreateAppDto) {
    return this.adminService.createApp(dto);
  }

  @Patch('apps/:id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  updateApp(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.adminService.updateApp(id, dto);
  }

  @Post('apps/reload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  reloadAppsCache() {
    return this.adminService.reloadAppsCache();
  }
}
