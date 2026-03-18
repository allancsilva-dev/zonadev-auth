# FASE 3 — Frontend: SPA (Renowa) + SSR (ERP)

## Contexto

Fases 1 e 2 concluídas: Auth emite zonadev_sid, cada SaaS tem permissões locais.
Agora conectamos os frontends ao novo fluxo SSO.

**PRÉ-REQUISITO:** Fases 1 e 2 validadas.

## Metodologia

1. LER a estrutura atual do frontend antes de modificar
2. Renowa (SPA) e ERP (SSR) têm implementações DIFERENTES
3. Testar cada app isoladamente, depois em conjunto
4. `npm run build` ao final — zero erros

---

## PARTE A — Renowa (SPA / Vite + React)

### Etapa 3A.1 — Módulo de autenticação

Criar `src/lib/auth.ts` (ou adaptar o existente):

```typescript
const AUTH_URL = import.meta.env.VITE_AUTH_URL;   // https://auth.zonadev.tech
const APP_AUD = import.meta.env.VITE_EXPECTED_AUD; // renowa.zonadev.tech

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  // Token válido? Retorna direto (60s de margem)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  // Mutex: se já tem refresh em andamento, aguarda
  if (refreshPromise) return refreshPromise;

  refreshPromise = doTokenExchange();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doTokenExchange(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `${AUTH_URL}/oauth/token?aud=${APP_AUD}`,
        { credentials: 'include' }
      );

      if (res.status === 401) {
        window.location.href = `${AUTH_URL}/login`
          + `?app=${APP_AUD}`
          + `&redirect=${encodeURIComponent(window.location.href)}`;
        throw new Error('Session expired');
      }

      if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

      const data = await res.json();
      accessToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return accessToken!;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export async function authFetch(
  url: string,
  opts: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...opts,
    headers: {
      ...opts.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function clearToken(): void {
  accessToken = null;
  tokenExpiresAt = 0;
}
```

### Etapa 3A.2 — Integrar com requests existentes

**LER ANTES:** como o Renowa faz chamadas à API hoje. Pode estar usando:
- fetch direto
- axios
- TanStack Query (useQuery/useMutation)

**Substituir** todas as chamadas autenticadas por `authFetch()`.

Se usa TanStack Query, criar um queryClient com default queryFn:

```typescript
import { authFetch } from './auth';

const API_URL = import.meta.env.VITE_API_URL;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await authFetch(`${API_URL}${queryKey[0]}`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      },
    },
  },
});
```

### Etapa 3A.3 — Logout

**LER ANTES:** como o logout funciona hoje no Renowa.

Refatorar para:

```typescript
async function handleLogout() {
  clearToken();

  // Chama logout no Auth (invalida zonadev_sid)
  await fetch(`${AUTH_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  // Redirect para login
  window.location.href = `${AUTH_URL}/login?app=${APP_AUD}`;
}
```

### Etapa 3A.4 — Remover código antigo

**BUSCAR e REMOVER:**
- Toda leitura de cookies `access_token` ou `refresh_token` via JavaScript
- Chamadas a POST /auth/refresh antigas
- Qualquer `credentials: 'include'` em requests para a API do Renowa (agora usa Authorization header)

### Etapa 3A.5 — Variáveis de ambiente

Verificar que existem no `.env` ou no docker-compose (build args):
```env
VITE_AUTH_URL=https://auth.zonadev.tech
VITE_API_URL=https://api.renowa.zonadev.tech/api
VITE_EXPECTED_AUD=renowa.zonadev.tech
```

---

## PARTE B — ERP Nexos (SSR / Next.js)

### Etapa 3B.1 — Middleware Next.js (token exchange)

**LER ANTES:** o middleware.ts atual do ERP (se existir).

Criar ou substituir `middleware.ts` na raiz do projeto Next.js:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const AUTH_URL = process.env.AUTH_URL!;     // https://auth.zonadev.tech
const APP_AUD = 'erp.zonadev.tech';
const COOKIE_NAME = 'erp_access_token';

const PUBLIC_PATHS = ['/login', '/api/auth/local-logout', '/_next', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  if (PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(COOKIE_NAME)?.value;
  const sid = req.cookies.get('zonadev_sid')?.value;

  // Token válido? Prossegue
  if (accessToken && !isTokenExpired(accessToken)) {
    return NextResponse.next();
  }

  // Tem sid mas token expirou? Faz token exchange
  if (sid) {
    try {
      const tokenRes = await fetch(
        `${AUTH_URL}/oauth/token?aud=${APP_AUD}`,
        {
          headers: { Cookie: `zonadev_sid=${sid}` },
          signal: AbortSignal.timeout(3000),
        },
      );

      if (tokenRes.ok) {
        const { access_token, expires_in } = await tokenRes.json();
        const response = NextResponse.next();
        response.cookies.set(COOKIE_NAME, access_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          domain: 'erp.zonadev.tech',
          maxAge: expires_in,
          path: '/',
        });
        return response;
      }
    } catch (err) {
      console.error('[ERP Middleware] Token exchange failed:', err);
    }
  }

  // Sem sid ou exchange falhou → redirect login
  const loginUrl = new URL(`${AUTH_URL}/login`);
  loginUrl.searchParams.set('app', APP_AUD);
  loginUrl.searchParams.set('redirect', req.url);
  return NextResponse.redirect(loginUrl);
}

// NOTA: Verifica APENAS exp (não assinatura/aud/iss).
// Isso é INTENCIONAL — o middleware é ponto de conveniência, não de segurança.
// Validação completa (RS256 via JWKS) acontece no backend NestJS.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );
    return Date.now() >= (payload.exp * 1000) - 60_000;
  } catch {
    return true;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Etapa 3B.2 — serverFetch (leitura do cookie scoped)

**LER ANTES:** `lib/server-fetch.ts` atual do ERP.

Refatorar para ler o cookie scoped em vez de cookies globais:

```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'erp_access_token';

export async function serverFetch(path: string) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) throw new Error('API_URL not defined');

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    console.error('[serverFetch] No token — middleware may have failed');
    redirect('/login');
  }

  const res = await fetch(`${apiUrl}${path}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    console.error(`[serverFetch] ${path} — ${res.status}`);
    throw new Error(`Failed: ${path} — ${res.status}`);
  }

  return res.json();
}
```

> **RESTRIÇÃO ARQUITETURAL (R2):** TODAS as chamadas à API devem passar por serverFetch(). Client Components que precisam de dados usam Server Actions ou API routes. NUNCA fetch direto do browser com token em memória.

### Etapa 3B.3 — Logout no ERP

No frontend Next.js, o botão de logout:

```typescript
async function handleLogout() {
  const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL;

  // Chama logout no Auth
  const res = await fetch(`${AUTH_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  const data = await res.json();

  // Limpa cookies locais via logoutUrls
  if (data.logoutUrls) {
    await Promise.allSettled(
      data.logoutUrls.map((url: string) =>
        fetch(url, { method: 'POST', credentials: 'include' })
      ),
    );
  }

  // Redirect para login
  window.location.href = `${AUTH_URL}/login?app=erp.zonadev.tech`;
}
```

### Etapa 3B.4 — Remover código antigo

**BUSCAR e REMOVER:**
- Leitura de cookies `access_token` ou `refresh_token` globais
- Chamadas a POST /auth/refresh antigas
- Qualquer lógica que sete cookies com `domain: '.zonadev.tech'` no frontend do ERP
- Referências a `NEXT_PUBLIC_API_URL` em Server Components (usar `API_URL` server-side)

### Etapa 3B.5 — Variáveis de ambiente

**frontend/.env.local:**
```env
AUTH_URL=https://auth.zonadev.tech
API_URL=http://nexos-backend:3001
NEXT_PUBLIC_AUTH_URL=https://auth.zonadev.tech
NEXT_PUBLIC_APP_AUDIENCE=erp.zonadev.tech
```

**docker-compose (build args):**
```yaml
args:
  NEXT_PUBLIC_AUTH_URL: https://auth.zonadev.tech
  NEXT_PUBLIC_APP_AUDIENCE: erp.zonadev.tech
```

---

## Validação Final da Fase 3

### Teste Renowa (SPA):
1. Acessar renowa.zonadev.tech sem sessão → redirect para auth.zonadev.tech/login
2. Login → redirect de volta → getAccessToken() busca JWT via sid → dashboard carrega
3. F5 → token perdido → re-fetch via sid → funciona (com +100-200ms)
4. Logout → redirect para login → zonadev_sid limpo
5. Verificar no DevTools → NÃO deve existir cookie access_token global

### Teste ERP (SSR):
1. Acessar erp.zonadev.tech sem sessão → redirect para auth.zonadev.tech/login
2. Login → redirect → middleware faz token exchange → seta erp_access_token → dashboard carrega
3. F5 → cookie persiste → carrega sem delay
4. Token expira (esperar 15min ou alterar exp) → middleware re-fetcha → transparente
5. Logout → cookies limpos → redirect para login
6. Verificar no DevTools → cookie erp_access_token com Domain=erp.zonadev.tech (scoped)

### Teste Cross-App:
1. Login no Renowa → funciona
2. Abrir ERP em outra aba → deve logar automaticamente (zonadev_sid compartilhado)
3. Logout no Auth → Renowa perde acesso no próximo getAccessToken() → ERP perde no próximo request SSR
4. Login no ERP → NÃO afeta sessão do Renowa (cookies isolados)

> **NÃO avançar para Fase 4 sem TODOS os testes passando — especialmente o teste cross-app.**
