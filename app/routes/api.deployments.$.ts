import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const AUTH_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxyToDeploymentsServer(request: Request, path: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  const url = `${AUTH_SERVER}/deployments${path ? `/${path}` : ''}${requestUrl.search}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const cookie = request.headers.get('cookie');

  if (cookie) {
    headers['cookie'] = cookie;
  }

  const authorization = request.headers.get('authorization');

  if (authorization) {
    headers['authorization'] = authorization;
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
  });

  const responseHeaders = new Headers();
  responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToDeploymentsServer(request, path);
};

export const action: ActionFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToDeploymentsServer(request, path);
};
