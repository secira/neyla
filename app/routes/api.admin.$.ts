import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const AUTH_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxyToAdminServer(request: Request, path: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  const url = `${AUTH_SERVER}/admin${path ? `/${path}` : ''}${requestUrl.search}`;
  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('content-type') || 'application/json',
  };
  const cookie = request.headers.get('cookie');

  if (cookie) {
    headers.cookie = cookie;
  }

  let body: string | undefined;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body,
  });
  const responseHeaders = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json',
  });
  const setCookie = upstream.headers.get('set-cookie');

  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie);
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const loader: LoaderFunction = async ({ request, params }) =>
  proxyToAdminServer(request, (params as any)['*'] || '');

export const action: ActionFunction = async ({ request, params }) =>
  proxyToAdminServer(request, (params as any)['*'] || '');