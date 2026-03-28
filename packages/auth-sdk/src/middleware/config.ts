import { ZonaDevAuthConfig } from '../types';

export function loadConfigFromEnv(): ZonaDevAuthConfig {
  const authUrl = process.env.AUTH_URL;
  const appAud = process.env.APP_AUD;
  const cookieName = process.env.APP_COOKIE_NAME;
  const appUrl = process.env.APP_URL;

  if (!authUrl || !appAud || !cookieName || !appUrl) {
    throw new Error('[ZonaDev Auth SDK] Missing required env vars: AUTH_URL, APP_AUD, APP_COOKIE_NAME, APP_URL');
  }

  return {
    authUrl,
    appAud,
    cookieName,
    appUrl,
    cookieDomain: process.env.COOKIE_DOMAIN,
  };
}
