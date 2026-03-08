import { cookies } from 'next/headers';

export interface MeResponse {
  sub: string;
  email: string;
  role: string;
  roles: string[];
  tenantId: string | null;
  tenantSubdomain: string | null;
  plan: string | null;
}

/**
 * Busca o utilizador autenticado no backend a partir dos cookies do servidor.
 * Deve ser usado APENAS em Server Components — nunca em 'use client'.
 *
 * IMPORTANTE: credentials: 'include' não funciona em Server Components do Next.js 15.
 * Os cookies devem ser lidos via next/headers e repassados manualmente no header Cookie.
 */
export async function getMe(): Promise<MeResponse | null> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return null;

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    if (!cookieHeader) return null;

    const res = await fetch(`${apiUrl}/auth/me`, {
      cache: 'no-store', // nunca cachear sessão em IdP
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as { sub: string; email: string; roles: string[]; tenantId: string | null; tenantSubdomain: string | null; plan: string | null };
    return {
      ...data,
      role: data.roles?.[0] ?? 'USER',
    };
  } catch {
    return null;
  }
}
