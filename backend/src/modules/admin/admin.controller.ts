import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Stats agregadas — calculadas no backend, nunca no frontend
  @Get('stats')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.adminService.getStats();
  }
}
