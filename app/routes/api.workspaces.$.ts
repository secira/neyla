import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const AUTH_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxyToWorkspacesServer(request: Request, path: string): Promise<Response> {
  const url = `${AUTH_SERVER}/workspaces${path ? `/${path}` : ''}`;

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
  });

  const responseHeaders = new Headers();
  responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');

  const setCookie = upstream.headers.get('set-cookie');

  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie);
  }

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToWorkspacesServer(request, path);
};

export const action: ActionFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToWorkspacesServer(request, path);
};
