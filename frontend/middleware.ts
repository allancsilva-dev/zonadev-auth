import { NextRequest, NextResponse } from 'next/server';

const APP_AUD = process.env.NEXT_PUBLIC_APP_AUD ?? 'auth.zonadev.tech';
const COOKIE_NAME = process.env.NEXT_PUBLIC_COOKIE_NAME ?? 'admin_access_token';
const AUTH_API_URL = process.env.API_URL;

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const sid = request.cookies.get('zonadev_sid')?.value;

  // Decode único — evita retrabalho
  const payload = token ? decodeJwtPayload(token) : null;

  // 1. Token presente mas inválido estruturalmente
  if (token && !isStructurallyValid(payload)) {
    console.error('[ERP Middleware] Token inválido — removendo');
    return clearTokenAndContinue(request);
  }

  // 2. Token presente, válido, mas expirado
  if (token && payload && isTokenExpired(payload)) {
    console.error('[ERP Middleware] Token expirado — removendo');
    return clearTokenAndContinue(request);
  }

  // 3. Token válido e não expirado — deixa passar
  if (token && payload && !isTokenExpired(payload)) {
    return NextResponse.next();
  }

  // 4. Sem token — verificar config antes do exchange
  if (!AUTH_API_URL) {
    console.error('[ERP Middleware] API_URL não definido');
    return redirectToLogin(request);
  }

  // 5. Sem token mas com sessão — token exchange
  if (sid) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const tokenRes = await fetch(
        `${AUTH_API_URL}/oauth/token?aud=${APP_AUD}`,
        {
          headers: {
            // Enviar APENAS zonadev_sid — nunca todos os cookies do browser
            Cookie: `zonadev_sid=${sid}`,
          },
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(timeout));

      if (tokenRes.ok) {
        const data = (await tokenRes.json()) as {
          access_token: string;
          expires_in: number;
        };
        const response = NextResponse.next();
        response.cookies.set(COOKIE_NAME, data.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          domain: getCookieDomain(),
          path: '/',
          maxAge: data.expires_in,
        });
        return response;
      }

      if (tokenRes.status === 401) {
        console.error('[ERP Middleware] Sessão inválida (401)');
        return redirectToLogin(request);
      }

      // 5xx ou outro erro — não deslogar, deixar passar
      console.error('[ERP Middleware] Backend indisponível', tokenRes.status);
      return NextResponse.next();

    } catch (error: unknown) {
      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError';
      console.error(
        isTimeout
          ? '[ERP Middleware] Timeout no token exchange'
          : '[ERP Middleware] Erro no token exchange',
        error,
      );
      // Falha transitória — não deslogar
      return NextResponse.next();
    }
  }

  // 6. Sem token e sem sessão — redirecionar para login
  return redirectToLogin(request);
}

// --- Helpers ---

function clearTokenAndContinue(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: getCookieDomain(),
    path: '/',
    maxAge: 0,
  });
  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('app', APP_AUD);
  loginUrl.searchParams.set('redirect', request.url);
  return NextResponse.redirect(loginUrl);
}

function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    // atob — compatível com Edge Runtime (sem Buffer/Node.js)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isStructurallyValid(
  payload: Record<string, unknown> | null,
): boolean {
  return (
    payload !== null &&
    typeof payload.sub === 'string' &&
    typeof payload.exp === 'number'
  );
}

function isTokenExpired(payload: Record<string, unknown>): boolean {
  const exp = payload.exp;
  if (typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000 - 60_000;
}

export const config = {
  matcher: ['/admin/:path*'],
};