import { NextRequest, NextResponse } from 'next/server';

const APP_AUD = 'auth.zonadev.tech';
const COOKIE_NAME = 'admin_access_token';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const sid = request.cookies.get('zonadev_sid')?.value;

  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (token && !isTokenExpired(token)) {
    return NextResponse.next();
  }

  if (sid) {
    try {
      const apiUrl = process.env.API_URL;
      if (apiUrl) {
        const tokenRes = await fetch(`${apiUrl}/oauth/token?aud=${APP_AUD}`, {
          headers: {
            Cookie: `zonadev_sid=${sid}`,
          },
          signal: AbortSignal.timeout(3000),
        });

        if (tokenRes.ok) {
          const data = (await tokenRes.json()) as {
            access_token: string;
            expires_in: number;
          };

          const response = NextResponse.next();
          response.cookies.set(COOKIE_NAME, data.access_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: data.expires_in,
          });

          return response;
        }
      }
    } catch {
      // Falha no token exchange segue para redirect de login abaixo.
    }
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// O middleware valida apenas exp por conveniencia.
// A verificacao criptografica completa (assinatura/aud/iss) ocorre no backend.
function isTokenExpired(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    if (!payload.exp) return true;
    return Date.now() >= (payload.exp * 1000) - 60_000;
  } catch {
    return true;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
