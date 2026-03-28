// redirect() retorna never — TypeScript já infere string aqui.
// Alias explícito para deixar a intenção clara.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function serverFetch<T>(path: string): Promise<T> {
  const API_URL = process.env.API_URL;
if (!API_URL) {
  console.error('[serverFetch] API_URL não definido');
  throw new Error('Configuração inválida do servidor (API_URL ausente)');
}

const cookieStore = await cookies();
const token = cookieStore.get('admin_access_token')?.value;

if (!token || token.split('.').length !== 3) {
  console.error(`[serverFetch] Token ausente ou inválido | path=${path}`);
  redirect('/login');
}

const safeToken = token; // narrowing: garante string após o bloco acima

const normalizedPath = path.startsWith('/') ? path : `/${path}`;
const url = `${API_URL.replace(/\/$/, '')}${normalizedPath}`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5_000);

try {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: controller.signal,
    headers: { Authorization: `Bearer ${safeToken}` },
  });

  if (res.status === 401) {
    console.error(`[serverFetch] 401 Unauthorized | path=${path} url=${url}`);
    redirect('/login');
  }
  if (res.status >= 500) {
    console.error(`[serverFetch] Backend erro ${res.status} | path=${path} url=${url}`);
    throw new Error('Backend indisponível. Tente novamente.');
  }
  if (!res.ok) {
    console.error(`[serverFetch] Erro ${res.status} | path=${path} url=${url}`);
    throw new Error(`Erro ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    console.error(`[serverFetch] Resposta não-JSON | path=${path} url=${url}`);
    throw new Error('Resposta inválida do servidor.');
  }

  return res.json() as Promise<T>;
} catch (error) {
  if (error instanceof Error && (error as any).digest?.startsWith('NEXT_REDIRECT')) {
    throw error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.error(`[serverFetch] Timeout | path=${path} url=${url}`);
    throw new Error('O servidor demorou para responder. Tente novamente.');
  }
  throw error;
} finally {
  clearTimeout(timeout);
}
}