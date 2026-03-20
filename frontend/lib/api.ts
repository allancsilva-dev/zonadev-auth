'use client';

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
 * No novo fluxo SSO, 401 significa sessão expirada/inválida e o middleware
 * é responsável por reconstruir o cookie admin_access_token via zonadev_sid.
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

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Sessao expirada. Redirecionando para login.');
  }

  return res;
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
