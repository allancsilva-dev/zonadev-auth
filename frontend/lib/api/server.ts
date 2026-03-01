// Usado apenas em Server Components (páginas).
// Nunca importar em Client Components ('use client').

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  // Não usar ?? '' — enviar Cookie vazio pode causar comportamento inesperado no backend.
  const token = cookieStore.get('access_token')?.value;

  const controller = new AbortController();
  // Timeout de 8s — backend travado não segura a renderização SSR inteira
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      cache: 'no-store', // dados de admin nunca são cacheados pelo Next
      signal: controller.signal,
      headers: {
        // Omite o header completamente se não há token — evita access_token= vazio
        ...(token ? { Cookie: `access_token=${token}` } : {}),
      },
    });

    if (res.status === 401) redirect('/login');

    if (!res.ok) {
      throw new Error(`Backend retornou ${res.status} para ${path}`);
    }

    // Guard contra proxy reverso mal configurado que retorna HTML em vez de JSON
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Resposta inválida do servidor. Esperado JSON.');
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('O servidor demorou para responder. Tente novamente.');
    }
    throw error;
    // TODO: observability v2 — enviar para Sentry/Datadog antes de relançar
  } finally {
    clearTimeout(timeout);
  }
}
