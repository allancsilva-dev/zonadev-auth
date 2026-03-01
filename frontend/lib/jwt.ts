// Decodifica o payload do JWT sem verificar a assinatura (RS256).
// A verificação real é feita SEMPRE pelo backend.
// Compatível com: Edge Runtime, Node 18+, Browser — sem dependências externas.

export interface JwtPayload {
  sub: string;
  role: string;
  tenantId: string | null;
  tenantSubdomain: string | null;
  plan: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url → base64 padrão (RFC 4648)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    // atob() é universal: Edge Runtime, Browser, Node 18+
    // NÃO usar Buffer.from() — incompatível com Edge Runtime
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null; // token malformado
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  return payload.exp * 1000 < Date.now(); // exp em segundos, Date.now() em ms
}

// Valida iss + aud — fecha superfície de ataque lateral.
// Impede tokens válidos de outros serviços (ex: zonadev-analytics) de acessar o admin.
export function isTokenTrusted(
  payload: JwtPayload,
  expectedIss: string,
  expectedAud: string
): boolean {
  return payload.iss === expectedIss && payload.aud === expectedAud;
}
