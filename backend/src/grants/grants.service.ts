import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthorizationGrant } from './authorization-grant.entity';

@Injectable()
export class GrantsService {
  constructor(
    @InjectRepository(AuthorizationGrant)
    private readonly grantRepository: Repository<AuthorizationGrant>,
  ) {}

  async findOrCreate(
    userId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<AuthorizationGrant> {
    let grant = await this.grantRepository.findOne({
      where: { userId, clientId, revokedAt: IsNull() },
    });

    if (!grant) {
      grant = await this.grantRepository.save({
        userId,
        clientId,
        scopes: requestedScopes,
      });
    } else {
      const mergedScopes = Array.from(new Set([...(grant.scopes ?? []), ...requestedScopes]));

      if (mergedScopes.length !== grant.scopes.length) {
        grant.scopes = mergedScopes;
        grant = await this.grantRepository.save(grant);
      }
    }

    return grant;
  }

  async revokeGrant(userId: string, clientId: string): Promise<void> {
    await this.grantRepository
      .createQueryBuilder()
      .update(AuthorizationGrant)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('client_id = :clientId', { clientId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}