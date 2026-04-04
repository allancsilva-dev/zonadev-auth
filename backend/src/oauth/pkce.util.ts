import { createHash, randomBytes } from 'crypto';

export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('hex');
}

export function generateResumeId(): string {
  return randomBytes(16).toString('hex');
}

export function generateJti(): string {
  return randomBytes(16).toString('hex');
}

export function validatePkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return computed === codeChallenge;
}

export function validateCodeVerifierFormat(codeVerifier: string): boolean {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false;
  }

  return /^[A-Za-z0-9\-._~]+$/.test(codeVerifier);
}