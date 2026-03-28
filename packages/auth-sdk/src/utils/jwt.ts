export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // support Node and browsers
    const json = typeof Buffer !== 'undefined'
      ? Buffer.from(padded, 'base64').toString('utf8')
      : atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isExpired(payload: Record<string, unknown>, marginMs = 30_000): boolean {
  const exp = payload.exp as number | undefined;
  if (typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000 - marginMs;
}
