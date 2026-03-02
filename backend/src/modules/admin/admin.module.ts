import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Subscription } from '../../entities/subscription.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, User, Subscription])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
