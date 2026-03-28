import { loadConfigFromEnv } from './config';
import { decodeJwtPayload, isExpired } from '../utils/jwt';
import { buildCookieOptions, clearCookieOptions } from '../utils/cookies';
import { buildLoginUrl } from '../utils/redirect';
import { ZonaDevAuthConfig } from '../types';

let _config: ZonaDevAuthConfig | null = null;
function getConfig(): ZonaDevAuthConfig {
  if (!_config) _config = loadConfigFromEnv();
  return _config;
}

export async function zonadevAuthMiddleware(request: any): Promise<any> {
  const config = getConfig();
  const token = request.cookies?.get?.(config.cookieName)?.value;
  const sid = request.cookies?.get?.('zonadev_sid')?.value;

  const payload = token ? decodeJwtPayload(token) : null;

  if (payload && !isExpired(payload)) {
    if ((payload as any).aud === config.appAud) return { action: 'next' } as any;
    // incorrect aud — clear cookie and continue
    return { action: 'clear' } as any;
  }

  if (token && !payload) {
    return { action: 'clear' } as any;
  }

  if (sid) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${config.authUrl}/oauth/token?aud=${config.appAud}`, {
        headers: { Cookie: `zonadev_sid=${sid}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        const data = await res.json();
        return { action: 'setToken', token: data.access_token, maxAge: data.expires_in } as any;
      }

      if (res.status === 401) {
        return { action: 'redirect', url: buildLoginUrl(config, request.nextUrl?.pathname ?? '/') } as any;
      }

      return { action: 'next' } as any;
    } catch {
      return { action: 'next' } as any;
    }
  }

  return { action: 'redirect', url: buildLoginUrl(config, request.nextUrl?.pathname ?? '/') } as any;
}

export default zonadevAuthMiddleware;
