import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Session } from '../entities/session.entity';

@Injectable()
export class CleanupJob {
  private readonly logger = new Logger(CleanupJob.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  /**
   * Job diário às 2h — remove refresh tokens desnecessários.
   *
   * Remove tokens:
   * - revogados (revoked_at IS NOT NULL)
   * - expirados (expires_at < now())
   *
   * Sem limpeza, a tabela acumula registros obsoletos indefinidamente,
   * degradando performance das queries em refresh_tokens.
   */
  @Cron('0 2 * * *', { name: 'cleanup-refresh-tokens' })
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = new Date();

      // Remove tokens revogados
      const revokedResult = await this.refreshTokenRepo.delete({
        revokedAt: Not(IsNull()),
      });

      // Remove tokens expirados não revogados
      const expiredResult = await this.refreshTokenRepo.delete({
        expiresAt: LessThan(now),
        revokedAt: IsNull(),
      });

      const total =
        (revokedResult.affected ?? 0) + (expiredResult.affected ?? 0);

      const revokedSessions = await this.sessionRepo.delete({
        revokedAt: Not(IsNull()),
      });

      const expiredSessions = await this.sessionRepo.delete({
        expiresAt: LessThan(now),
        revokedAt: IsNull(),
      });

      const sessionsTotal =
        (revokedSessions.affected ?? 0) + (expiredSessions.affected ?? 0);

      this.logger.log(
        `Cleanup concluido: refresh=${total}, sessions=${sessionsTotal}`,
      );
    } catch (err) {
      this.logger.error(`Falha no cleanup job: ${err}`);
    }
  }
}
