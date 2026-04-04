import { IsIn, IsOptional, IsString } from 'class-validator';

export class AuthorizeQuery {
  @IsString()
  client_id: string;

  @IsString()
  redirect_uri: string;

  @IsIn(['code'])
  response_type: string;

  @IsString()
  scope: string;

  @IsString()
  state: string;

  @IsString()
  code_challenge: string;

  @IsIn(['S256'])
  code_challenge_method: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}

export interface AuthorizationCodePayload {
  clientId: string;
  userId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  nonce?: string;
  createdAt: number;
}

export interface ResumePayload {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
  createdAt: number;
}

export class TokenBody {
  @IsIn(['authorization_code'])
  grant_type: string;

  @IsString()
  code: string;

  @IsString()
  redirect_uri: string;

  @IsString()
  client_id: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsString()
  code_verifier: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface AccessTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  azp: string;
  scope: string;
  tenantId: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
}