export interface AuthorizeQuery {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
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

export interface TokenBody {
  grant_type: string;
  code: string;
  redirect_uri: string;
  client_id: string;
  client_secret?: string;
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