import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const AUTH_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxyToAuthServer(request: Request, path: string): Promise<Response> {
  const url = `${AUTH_SERVER}/auth/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const cookie = request.headers.get('cookie');

  if (cookie) {
    headers['cookie'] = cookie;
  }

  let body: string | undefined;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();

  const setCookie = upstream.headers.get('set-cookie');

  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie);
  }

  responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');

  const location = upstream.headers.get('location');

  if (location) {
    responseHeaders.set('location', location);
  }

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToAuthServer(request, path);
};

export const action: ActionFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToAuthServer(request, path);
};
