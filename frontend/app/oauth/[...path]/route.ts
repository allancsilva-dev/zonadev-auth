import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL;

function splitSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if ((char === 'E' || char === 'e') && value.slice(index, index + 8).toLowerCase() === 'expires=') {
      inExpires = true;
      index += 7;
      continue;
    }

    if (char === ';' && inExpires) {
      inExpires = false;
      continue;
    }

    if (char === ',' && !inExpires) {
      const cookie = value.slice(start, index).trim();
      if (cookie) cookies.push(cookie);
      start = index + 1;
    }
  }

  const tail = value.slice(start).trim();
  if (tail) cookies.push(tail);

  return cookies;
}

function getSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const raw = headers.get('set-cookie');
  if (!raw) {
    return [];
  }

  return splitSetCookieHeader(raw);
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!API_URL) {
    return new Response(JSON.stringify({ message: 'API_URL não configurada' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const segments = (await params).path.join('/');
  const url = request.nextUrl.clone();
  const target = new URL(`${API_URL}/oauth/${segments}${url.search}`);

  const headers = new Headers(request.headers);
  headers.set('host', target.host);

  const body = ['GET', 'HEAD'].includes(request.method)
    ? null
    : await request.arrayBuffer();

  try {
    const response = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: body || undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        responseHeaders.append(key, value);
      }
    });

    const setCookies = getSetCookies(response.headers);
    for (const cookie of setCookies) {
      responseHeaders.append('set-cookie', cookie);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ message: 'Backend indisponível' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const GET = handler;
export const POST = handler;