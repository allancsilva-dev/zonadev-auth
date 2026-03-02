import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const accessToken  = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');

  // Se não há nenhum token, redirigir para login com contexto
  if (!accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    const expectedAud = process.env.JWT_EXPECTED_AUD;
    if (expectedAud) loginUrl.searchParams.set('aud', expectedAud);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Se o access token expirou mas ainda há refresh token, deixa passar —
  // o layout.tsx faz a validação completa e o silent refresh trata o resto.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
