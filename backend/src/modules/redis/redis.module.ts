import { Global, Module } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        // lazy require to avoid top-level ESM/TS resolution issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const IORedis = require('ioredis');
        return new IORedis(process.env.REDIS_HOST ?? 'redis', parseInt(process.env.REDIS_PORT ?? '6379'));
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
