import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL;

function splitSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if ((char === 'E' || char === 'e') && value.slice(i, i + 8).toLowerCase() === 'expires=') {
      inExpires = true;
      i += 7;
      continue;
    }

    if (char === ';' && inExpires) {
      inExpires = false;
      continue;
    }

    if (char === ',' && !inExpires) {
      const cookie = value.slice(start, i).trim();
      if (cookie) cookies.push(cookie);
      start = i + 1;
    }
  }

  const tail = value.slice(start).trim();
  if (tail) cookies.push(tail);

  return cookies;
}

function extractSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const withRaw = headers as Headers & { raw?: () => Record<string, string[]> };
  if (typeof withRaw.raw === 'function') {
    const rawHeaders = withRaw.raw();
    return rawHeaders['set-cookie'] ?? rawHeaders['Set-Cookie'] ?? [];
  }

  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return splitSetCookieHeader(combined);
}

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!API_URL) {
    return new Response(JSON.stringify({ message: 'API_URL não configurada' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  const url = request.nextUrl.clone();

  const backendUrl = new URL(`${API_URL}/${path}${url.search}`);

  const headers = new Headers(request.headers);
  const accessToken = request.cookies.get('admin_access_token')?.value;

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  // Corrige o header Host para evitar problemas no NestJS
  headers.set('host', backendUrl.host);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : null;

  try {
    const res = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: body ? body : undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    res.headers.forEach((headerValue, headerKey) => {
      if (headerKey.toLowerCase() === 'set-cookie') return;
      responseHeaders.append(headerKey, headerValue);
    });

    const setCookies = extractSetCookies(res.headers);
    for (const cookie of setCookies) {
      responseHeaders.append('set-cookie', cookie);
    }

    // Repassa headers do backend preservando todos os Set-Cookie.
    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ message: 'Backend indisponível' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const GET    = handleProxy;
export const POST   = handleProxy;
export const PUT    = handleProxy;
export const PATCH  = handleProxy;
export const DELETE = handleProxy;
