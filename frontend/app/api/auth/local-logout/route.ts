import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.NEXT_PUBLIC_COOKIE_NAME ?? 'admin_access_token';

function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
}

function buildCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');

  const ALLOWED_ORIGINS =
    process.env.NODE_ENV === 'production'
      ? ['https://auth.zonadev.tech', 'https://renowa.zonadev.tech']
      : ['http://localhost:3000', 'http://localhost:3001'];

  // Sem origin (Postman, curl, server-to-server)
  if (!origin) {
    return {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }

  // Origin não permitida → não enviar CORS inválido
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json(
    { success: true },
    { headers: buildCorsHeaders(request) }
  );

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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}