import { Global, Module, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { ConnectionOptions } from 'tls';
import { REDIS_CLIENT } from './redis.constants';

class RedisClientProvider implements OnModuleDestroy {
  private readonly logger = new Logger('RedisModule');
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}
  async onModuleDestroy() {
    this.logger.log('Redis desconectando...');
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.error('Erro ao fechar Redis', (err as Error).stack);
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisModule');

        const rawPort = Number(process.env.REDIS_PORT);
        const port = rawPort > 0 ? rawPort : 6379;
        const password = process.env.REDIS_PASSWORD || undefined;

        const client = new Redis({
          host: process.env.REDIS_HOST ?? 'redis',
          port,
          password,
          tls: process.env.REDIS_TLS === 'true' ? ({} as ConnectionOptions) : undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          enableOfflineQueue: false,
          retryStrategy(times: number) {
            if (times > 10) {
              return null;
            }
            return Math.min(times * 100, 2000);
          },
        });

        client.on('ready', () => logger.log('Redis pronto'));
        client.on('reconnecting', () => logger.warn('Redis reconectando...'));
        client.on('error', (err: Error) => logger.error('Redis erro', err.stack));

        return client;
      },
    },
    RedisClientProvider,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
