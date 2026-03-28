import { ZonaDevAuthConfig } from '../types';

export function buildLoginUrl(config: ZonaDevAuthConfig, pathname: string, search = ''): string {
  const loginUrl = new URL('/login', config.authUrl);
  loginUrl.searchParams.set('app', config.appAud);
  loginUrl.searchParams.set('redirect', config.appUrl + pathname + search);
  return loginUrl.toString();
}

export function safeRedirect(target: string, fallback = '/'): string {
  try {
    const u = new URL(target);
    return u.toString();
  } catch {
    return fallback;
  }
}
