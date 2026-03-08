import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function GET() {
  if (!API_URL) {
    return NextResponse.json({ error: 'API_URL não configurada' }, { status: 503 });
  }

  try {
    const response = await fetch(`${API_URL}/.well-known/jwks.json`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`JWKS backend error: ${response.status}`);
      return NextResponse.json({ error: 'Failed to fetch JWKS from backend' }, { status: 503 });
    }

    const jwks = await response.json();

    return NextResponse.json(jwks, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('JWKS proxy error:', error);
    return NextResponse.json({ error: 'JWKS service unavailable' }, { status: 503 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}
