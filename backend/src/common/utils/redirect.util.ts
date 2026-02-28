/**
 * Valida se uma URL de redirect é segura.
 *
 * Aceita apenas subdomínios do domínio configurado via env (DOMAIN).
 * Protege contra Open Redirect em ambas as camadas (backend + frontend).
 *
 * Versão robusta: evita edge cases como:
 *   evilzonadev.tech   → hostname.endsWith('.zonadev.tech') retornaria false corretamente
 *   zonadev.tech.evil.com → hostname.endsWith('.zonadev.tech') retornaria false corretamente
 */
export function isSafeRedirect(
  url: string,
  domain: string = process.env.DOMAIN ?? 'zonadev.tech',
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === domain ||
      parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export const SAFE_REDIRECT_FALLBACK = 'https://auth.zonadev.tech';
