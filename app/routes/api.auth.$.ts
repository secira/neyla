import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const AUTH_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxyToAuthServer(request: Request, path: string): Promise<Response> {
  const reqUrl = new URL(request.url);
  const url = `${AUTH_SERVER}/auth/${path}${reqUrl.search}`;
  const forwardedHost = request.headers.get('x-forwarded-host') || reqUrl.host;
  const forwardedProto = request.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-host': forwardedHost,
    'x-forwarded-proto': forwardedProto,
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

  const responseInit: ResponseInit = { status: upstream.status };
  const responseHeaders = new Headers();

  // Forward all Set-Cookie headers individually (handles multiple cookies correctly)
  const setCookies: string[] =
    typeof (upstream.headers as any).getSetCookie === 'function'
      ? (upstream.headers as any).getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie') as string] : []);

  for (const sc of setCookies) {
    responseHeaders.append('set-cookie', sc);
  }

  responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');

  const location = upstream.headers.get('location');

  if (location) {
    responseHeaders.set('location', location);
  }

  responseInit.headers = responseHeaders;

  const text = await upstream.text();

  return new Response(text, responseInit);
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToAuthServer(request, path);
};

export const action: ActionFunction = async ({ request, params }) => {
  const path = (params as any)['*'] || '';
  return proxyToAuthServer(request, path);
};
