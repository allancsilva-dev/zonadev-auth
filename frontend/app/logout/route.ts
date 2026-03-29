import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const COOKIE_NAME = process.env.COOKIE_NAME ?? 'admin_access_token';

function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  return process.env.COOKIE_DOMAIN;
}

export async function GET(request: NextRequest) {
  const postLogoutRedirectUri = request.nextUrl.searchParams.get('post_logout_redirect_uri');

  // Call backend to revoke session and refresh tokens
  if (API_URL) {
    try {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const backendUrl = new URL('/auth/logout', API_URL);
      if (postLogoutRedirectUri) {
        backendUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
      }

      await fetch(backendUrl.toString(), {
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
        },
        redirect: 'manual',
      });
    } catch (err) {
      console.error('[Logout] Failed to call backend logout:', err);
    }
  }

  const redirectTo = postLogoutRedirectUri || '/login';

  const response = NextResponse.redirect(
    redirectTo.startsWith('http') ? redirectTo : new URL(redirectTo, request.url),
  );

  // Clear local admin access token cookie
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: getCookieDomain(),
    path: '/',
    maxAge: 0,
  });

  // Also clear zonadev_sid cookie in the browser
  response.cookies.set('zonadev_sid', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.zonadev.tech' : undefined,
    path: '/',
    maxAge: 0,
  });

  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
