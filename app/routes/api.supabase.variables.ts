import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Add proper type assertion for the request body
    const body = (await request.json()) as { projectId?: string; token?: string };
    const { projectId, token } = body;

    if (!projectId || !token) {
      return json({ error: 'Project ID and token are required' }, { status: 400 });
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return json({ error: `Failed to fetch API keys: ${response.statusText}` }, { status: response.status });
    }

    const apiKeys = (await response.json()) as Array<{ name?: string; api_key?: string }>;
    const publicApiKeys = apiKeys
      .filter((key) => (key.name === 'anon' || key.name === 'public') && typeof key.api_key === 'string')
      .map((key) => ({
        name: key.name,
        api_key: key.api_key,
      }));

    // The Supabase service_role key is a server secret and must never cross
    // this boundary. The browser only needs the publishable anon key.
    return json({ apiKeys: publicApiKeys });
  } catch (error) {
    console.error('Error fetching project API keys:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Failed to fetch project API keys' }, { status: 500 });
  }
}
