import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL;

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

    // Repassa todos os headers do backend, incluindo Set-Cookie
    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
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
