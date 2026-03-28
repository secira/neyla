import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

const SANDBOX_SERVER = process.env.AUTH_SERVER_URL || 'http://localhost:3001';

async function proxySandbox(request: Request, params: Record<string, string | undefined>) {
  const splat = params['*'] || '';
  const url = new URL(request.url);
  const targetUrl = `${SANDBOX_SERVER}/sandbox/${splat}${url.search}`;

  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
  };

  const sandboxId = request.headers.get('x-sandbox-id');
  if (sandboxId) {
    headers['x-sandbox-id'] = sandboxId;
  }

  let body: BodyInit | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const contentType = response.headers.get('Content-Type') || 'application/json';

  if (contentType.includes('text/event-stream')) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: { 'Content-Type': contentType },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return proxySandbox(request, params);
}

export async function action({ request, params }: ActionFunctionArgs) {
  return proxySandbox(request, params);
}
