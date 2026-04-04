import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import * as bcryptjs from 'bcryptjs';
import { REDIS_CLIENT } from '../modules/redis/redis.constants';
import { ClientsService } from '../clients/clients.service';
import { UserSessionsService } from '../sessions/user-sessions.service';
import { GrantsService } from '../grants/grants.service';
import {
  AuthorizeQuery,
  AccessTokenClaims,
  AuthorizationCodePayload,
  ResumePayload,
  TokenBody,
  TokenResponse,
} from './dto/authorize.dto';
import {
  generateAuthorizationCode,
  generateJti,
  generateResumeId,
  validateCodeVerifierFormat,
  validatePkce,
} from './pkce.util';
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
    private readonly jwtService: JwtService,
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

  async issueToken(body: TokenBody): Promise<TokenResponse> {
    if (body.grant_type !== 'authorization_code') {
      throw new BadRequestException(
        OidcError.invalidGrant('grant_type deve ser "authorization_code"'),
      );
    }

    if (!body.code || !body.redirect_uri || !body.client_id || !body.code_verifier) {
      throw new BadRequestException(
        OidcError.invalidRequest(
          'Campos obrigatórios ausentes: code, redirect_uri, client_id, code_verifier',
        ),
      );
    }

    if (!validateCodeVerifierFormat(body.code_verifier)) {
      throw new BadRequestException(
        OidcError.invalidRequest('code_verifier com formato inválido'),
      );
    }

    const codeKey = `auth:code:${body.code}`;
    const raw = await this.redis.get(codeKey);

    if (!raw) {
      throw new BadRequestException(
        OidcError.invalidGrant('authorization_code inválido ou expirado'),
      );
    }

    let codePayload: AuthorizationCodePayload;
    try {
      codePayload = JSON.parse(raw) as AuthorizationCodePayload;
    } catch {
      await this.redis.del(codeKey);
      throw new BadRequestException(
        OidcError.invalidGrant('authorization_code corrompido'),
      );
    }

    const client = await this.clientsService.validateClient(
      body.client_id,
      codePayload.tenantId,
    );

    if (client.id !== codePayload.clientId) {
      throw new UnauthorizedException(
        OidcError.invalidGrant('client_id não corresponde ao code'),
      );
    }

    if (body.redirect_uri !== codePayload.redirectUri) {
      throw new BadRequestException(
        OidcError.invalidGrant('redirect_uri não corresponde ao code'),
      );
    }

    if (!validatePkce(body.code_verifier, codePayload.codeChallenge)) {
      throw new BadRequestException(
        OidcError.invalidGrant('code_verifier inválido'),
      );
    }

    if (client.clientSecretHash) {
      if (!body.client_secret) {
        throw new UnauthorizedException(
          OidcError.invalidClient('client_secret obrigatório para este client'),
        );
      }

      const secretValid = await bcryptjs.compare(body.client_secret, client.clientSecretHash);
      if (!secretValid) {
        throw new UnauthorizedException(
          OidcError.invalidClient('client_secret inválido'),
        );
      }
    }

    await this.redis.del(codeKey);

    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      sub: codePayload.userId,
      iss: process.env.JWT_ISSUER ?? 'https://auth.zonadev.tech',
      aud: body.client_id,
      azp: body.client_id,
      scope: codePayload.scopes.join(' '),
      tenantId: codePayload.tenantId,
      jti: generateJti(),
      iat: now,
      nbf: now,
      exp: now + client.accessTokenTtl,
    };

    const accessToken = this.signToken(claims);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: client.accessTokenTtl,
      scope: claims.scope,
    };
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

  private signToken(claims: AccessTokenClaims): string {
    const kid = process.env.JWT_KID ?? 'zonadev-default';

    return this.jwtService.sign(
      {
        sub: claims.sub,
        iss: claims.iss,
        aud: claims.aud,
        azp: claims.azp,
        scope: claims.scope,
        tenantId: claims.tenantId,
        jti: claims.jti,
      },
      {
        algorithm: 'RS256',
        expiresIn: `${claims.exp - claims.iat}s`,
        header: { kid, alg: 'RS256' },
      },
    );
  }
}