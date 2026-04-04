import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserSession } from './user-session.entity';
import { Client } from '../clients/client.entity';

@Injectable()
export class UserSessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async createSession(
    userId: string,
    clientId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<UserSession> {
    return this.sessionRepository.manager.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(UserSession);
      const clientRepo = manager.getRepository(Client);

      const activeSessions = await sessionRepo
        .createQueryBuilder('s')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.client_id = :clientId', { clientId })
        .andWhere('s.revoked_at IS NULL')
        .orderBy('s.created_at', 'ASC')
        .useTransaction(true)
        .setLock('pessimistic_write')
        .getMany();

      const client = await clientRepo.findOneOrFail({
        where: { id: clientId, active: true },
      });

      if (activeSessions.length >= client.maxSessionsPerUser) {
        const oldest = activeSessions[0];
        await sessionRepo.update(oldest.id, {
          revokedAt: new Date(),
          revokeReason: 'session_limit_exceeded',
        });
      }

      return sessionRepo.save({
        userId,
        clientId,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      });
    });
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: { userId, revokedAt: IsNull() },
      relations: ['client'],
    });
  }

  async revokeSession(
    sessionId: string,
    reason: 'user_logout' | 'global_logout' | 'token_reuse_detected' | 'expired',
  ): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      revokedAt: new Date(),
      revokeReason: reason,
    });
  }

  async revokeAllClientSessions(userId: string, clientId: string): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date(), revokeReason: 'user_logout' })
      .where('user_id = :userId', { userId })
      .andWhere('client_id = :clientId', { clientId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date(), revokeReason: 'global_logout' })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}