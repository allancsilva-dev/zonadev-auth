'use client';

import { ApiError } from '@/types/api-error';

let isRefreshing = false;
let waitQueue: Array<(success: boolean) => void> = [];

function resolveQueue(success: boolean) {
  waitQueue.forEach(cb => cb(success));
  waitQueue = [];
}

async function tryRefresh(): Promise<boolean> {
  // Se já há um refresh em andamento, entra na fila e aguarda
  if (isRefreshing) {
    return new Promise(resolve => waitQueue.push(resolve));
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    resolveQueue(res.ok);
    return res.ok;
  } catch {
    resolveQueue(false);
    return false;
  } finally {
    isRefreshing = false;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const doFetch = () =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        // Não injetar Content-Type em FormData — o browser define com o boundary correto
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

  try {
    let res = await doFetch();

    if (res.status === 401) {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        window.location.href = '/login';
        throw new Error('Sessão expirada. Redirecionando para o login.');
      }
      res = await doFetch(); // repete com os novos cookies
    }

    // 403: usuário autenticado mas sem permissão — não tenta refresh
    // TODO: 403 handler v2 — toast de permissão negada sem redirect

    if (!res.ok) {
      const body: Partial<ApiError> = await res.json().catch(() => ({}));
      throw new Error(body.message || `Erro ${res.status}`);
      // TODO: api-error v2 — lançar ApiError completo para tratamento por code
    }

    if (res.status === 204) return undefined as T; // No Content
    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A requisição demorou muito. Tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
