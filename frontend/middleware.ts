import { NextRequest, NextResponse } from 'next/server';

const APP_AUD = process.env.APP_AUD ?? 'auth.zonadev.tech';
const COOKIE_NAME = process.env.COOKIE_NAME ?? 'admin_access_token';
const AUTH_API_URL = process.env.API_URL;

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const sid = request.cookies.get('zonadev_sid')?.value;
  const pathname = request.nextUrl.pathname;

  // Decode único — evita retrabalho
  const payload = token ? decodeJwtPayload(token) : null;

  // 1. Token inválido estruturalmente
  if (token && !isStructurallyValid(payload)) {
    console.error('[Middleware] Token inválido — removendo');
    return clearTokenAndContinue();
  }

  // 2. Token expirado
  if (token && payload && isTokenExpired(payload)) {
    console.error('[Middleware] Token expirado — removendo');
    return clearTokenAndContinue();
  }

  // 3. Token válido
  if (token && payload && !isTokenExpired(payload)) {
    // 🔴 CORREÇÃO: sair do login se já autenticado
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
  }

  // 4. Sem API_URL
  if (!AUTH_API_URL) {
    console.error('[Middleware] API_URL não definido');
    return redirectToLogin(request);
  }

  // 5. Token exchange via SID
  if (sid) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const tokenRes = await fetch(
        `${AUTH_API_URL}/oauth/token?aud=${APP_AUD}`,
        {
          headers: {
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

        const response = NextResponse.redirect(request.url);

        response.cookies.set(COOKIE_NAME, data.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: data.expires_in,
        });

        return response;
      }

      if (tokenRes.status === 401) {
        console.error('[Middleware] Sessão inválida (401)');
        return redirectToLogin(request);
      }

      console.error('[Middleware] Backend indisponível', tokenRes.status);
      return NextResponse.next();

    } catch (error: unknown) {
      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError';

      console.error(
        isTimeout
          ? '[Middleware] Timeout no token exchange'
          : '[Middleware] Erro no token exchange',
        error,
      );

      return NextResponse.next();
    }
  }

  // 6. Sem token e sem SID
  return redirectToLogin(request);
}

// --- Helpers ---

function clearTokenAndContinue(): NextResponse {
  const response = NextResponse.next();

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', 'https://auth.zonadev.tech');
  loginUrl.searchParams.set('app', APP_AUD);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
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
  matcher: ['/((?!_next|favicon.ico|api|health|login).*)'],
};