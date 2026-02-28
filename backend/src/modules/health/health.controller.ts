import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Response } from 'express';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res() res: Response) {
    const start = Date.now();
    let dbStatus = 'ok';
    let latencyMs: number | null = null;

    try {
      await this.dataSource.query('SELECT 1');
      latencyMs = Date.now() - start;
    } catch {
      dbStatus = 'unavailable';
    }

    const overall = dbStatus === 'ok' ? 'ok' : 'degraded';
    const httpStatus = overall === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(httpStatus).json({
      status: overall,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latency_ms: latencyMs,
        },
      },
    });
  }
}
