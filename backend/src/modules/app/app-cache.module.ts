import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from '../../entities/app.entity';
import { AppCacheService } from './app-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([App])],
  providers: [AppCacheService],
  exports: [AppCacheService, TypeOrmModule],
})
export class AppCacheModule {}
