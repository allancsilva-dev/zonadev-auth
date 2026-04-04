import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../modules/redis/redis.constants';
import { ClientsService } from '../clients/clients.service';
import { UserSessionsService } from '../sessions/user-sessions.service';
import { GrantsService } from '../grants/grants.service';
import {
  AuthorizeQuery,
  AuthorizationCodePayload,
  ResumePayload,
} from './dto/authorize.dto';
import { generateAuthorizationCode, generateResumeId } from './pkce.util';
import { OidcError } from '../common/oidc-errors';
import { Client } from '../clients/client.entity';

const CODE_TTL_SECONDS = 300;
const RESUME_TTL_SECONDS = 300;

@Injectable()
export class OAuthService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly clientsService: ClientsService,
    private readonly sessionsService: UserSessionsService,
    private readonly grantsService: GrantsService,
  ) {}

  async authorize(
    query: AuthorizeQuery,
    session: { userId: string; tenantId: string } | null,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ redirectTo: string }> {
    if (query.response_type !== 'code') {
      throw new BadRequestException(
        OidcError.invalidRequest('response_type deve ser "code"'),
      );
    }

    if (query.code_challenge_method !== 'S256') {
      throw new BadRequestException(
        OidcError.invalidRequest('code_challenge_method deve ser "S256"'),
      );
    }

    if (!query.code_challenge || query.code_challenge.length < 43) {
      throw new BadRequestException(
        OidcError.invalidRequest('code_challenge ausente ou inválido'),
      );
    }

    if (!query.scope || !query.scope.trim()) {
      throw new BadRequestException(OidcError.invalidRequest('scope é obrigatório'));
    }

    if (!session) {
      const resumeId = generateResumeId();
      const resumePayload: ResumePayload = {
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        responseType: query.response_type,
        scope: query.scope,
        state: query.state,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
        nonce: query.nonce,
        createdAt: Math.floor(Date.now() / 1000),
      };

      await this.redis.setex(
        `auth:resume:${resumeId}`,
        RESUME_TTL_SECONDS,
        JSON.stringify(resumePayload),
      );

      if (!process.env.AUTH_BASE_URL) {
        throw new Error('AUTH_BASE_URL não configurado');
      }

      return { redirectTo: `${process.env.AUTH_BASE_URL}/login?resume=${resumeId}` };
    }

    const client = await this.clientsService.validateClient(
      query.client_id,
      session.tenantId,
    );

    this.clientsService.validateRedirectUri(client, query.redirect_uri, 'login');

    return this.issueAuthorizationCode(query, session, client, meta);
  }

  async resume(
    resumeId: string,
    session: { userId: string; tenantId: string },
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ redirectTo: string }> {
    const resumeKey = `auth:resume:${resumeId}`;
    const raw = await this.redis.get(resumeKey);

    if (!raw) {
      throw new BadRequestException(
        OidcError.invalidRequest('resume inválido ou expirado'),
      );
    }

    await this.redis.del(resumeKey);

    let payload: ResumePayload;
    try {
      payload = JSON.parse(raw) as ResumePayload;
    } catch {
      throw new BadRequestException(OidcError.invalidRequest('resume corrompido'));
    }

    const query: AuthorizeQuery = {
      client_id: payload.clientId,
      redirect_uri: payload.redirectUri,
      response_type: payload.responseType,
      scope: payload.scope,
      state: payload.state,
      code_challenge: payload.codeChallenge,
      code_challenge_method: payload.codeChallengeMethod,
      nonce: payload.nonce,
    };

    const client = await this.clientsService.validateClient(
      query.client_id,
      session.tenantId,
    );

    this.clientsService.validateRedirectUri(client, query.redirect_uri, 'login');

    return this.issueAuthorizationCode(query, session, client, meta);
  }

  private async issueAuthorizationCode(
    query: AuthorizeQuery,
    session: { userId: string; tenantId: string },
    client: Client,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ redirectTo: string }> {
    const scopes = query.scope.split(' ').filter(Boolean);

    await this.grantsService.findOrCreate(session.userId, client.id, scopes);

    const code = generateAuthorizationCode();
    const codePayload: AuthorizationCodePayload = {
      clientId: client.id,
      userId: session.userId,
      tenantId: session.tenantId,
      redirectUri: query.redirect_uri,
      scopes,
      state: query.state,
      codeChallenge: query.code_challenge,
      codeChallengeMethod: 'S256',
      nonce: query.nonce,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await this.redis.setex(
      `auth:code:${code}`,
      CODE_TTL_SECONDS,
      JSON.stringify(codePayload),
    );

    await this.sessionsService.createSession(session.userId, client.id, meta);

    const callbackUrl = new URL(query.redirect_uri);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', query.state);

    return { redirectTo: callbackUrl.toString() };
  }
}