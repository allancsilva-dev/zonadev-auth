import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtPayload, isTokenExpired, isTokenTrusted } from '@/lib/jwt';

// Lidos no módulo — sem NEXT_PUBLIC_, nunca chegam ao bundle do cliente
const EXPECTED_ISS = process.env.JWT_EXPECTED_ISS;
const EXPECTED_AUD = process.env.JWT_EXPECTED_AUD;

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Guard — undefined === payload.iss passaria silenciosamente em env mal configurada
  if (!EXPECTED_ISS || !EXPECTED_AUD) {
    console.error('[middleware] JWT_EXPECTED_ISS ou JWT_EXPECTED_AUD não configurados.');
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const token = req.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);

  // Validação em cascata — falha no primeiro critério inválido
  if (
    !payload ||
    isTokenExpired(payload) ||
    !isTokenTrusted(payload, EXPECTED_ISS, EXPECTED_AUD) ||
    payload.role !== 'SUPERADMIN'
  ) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Compatível com futura migração para admin.zonadev.tech:
  // basta ajustar matcher para '/:path*' e configurar DNS/rewrites
  matcher: ['/admin/:path*'],
};
