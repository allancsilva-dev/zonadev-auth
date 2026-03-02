'use client';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: Response) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: Error | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      // Os callbacks retornam a chamada original — resolvido externamente
      resolve(undefined as unknown as Response);
    }
  });
  failedQueue = [];
}

/**
 * Redirige para /login com limpeza forçada do estado React.
 * window.location.replace é intencional: garante que o estado do QueryClient
 * seja limpo na desautenticação — mais seguro que router.replace.
 */
export function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}

/**
 * Wrapper de fetch que chama sempre /api/... (proxy Next.js), nunca o backend directamente.
 * Implementa silent refresh: 401 tenta POST /api/auth/refresh antes de ejectar o utilizador.
 * Requests simultâneos durante o refresh ficam em fila e são retentados automaticamente.
 */
export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status !== 401) return res;

  // 401 — tenta refresh silencioso
  if (isRefreshing) {
    // Requests concorrentes ficam em fila durante o refresh
    return new Promise((resolve, reject) => {
      failedQueue.push({
        resolve: () => resolve(apiFetch(path, options)),
        reject,
      });
    });
  }

  isRefreshing = true;

  try {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!refreshRes.ok) {
      throw new Error('Refresh failed');
    }

    processQueue(null);
    return apiFetch(path, options);
  } catch (err) {
    processQueue(err as Error);
    handleUnauthorized();
    throw err;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Wrapper tipado que extrai o JSON da response.
 * Lança erro com a mensagem do backend se a resposta não for ok.
 */
export async function apiFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Erro ${res.status}`);
  }

  return res.json() as Promise<T>;
}
