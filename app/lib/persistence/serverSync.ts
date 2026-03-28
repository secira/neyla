import type { Message } from 'ai';
import { authUserAtom } from '~/lib/stores/auth';
import type { Snapshot } from './types';

const API_BASE = '/api/workspaces';

function isLoggedIn(): boolean {
  return authUserAtom.get() !== null;
}

async function fetchAPI(path: string, method: string, body?: unknown): Promise<Response | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  } catch {
    return null;
  }
}

let syncCache: Record<string, string> = {};

async function getOrCreateWorkspace(urlId: string, title?: string): Promise<string | null> {
  if (syncCache[urlId]) {
    return syncCache[urlId];
  }

  const listRes = await fetchAPI('', 'GET');
  if (!listRes || !listRes.ok) return null;

  const data = await listRes.json();
  const existing = (data.workspaces || []).find((w: any) => w.url_id === urlId);

  if (existing) {
    syncCache[urlId] = existing.id;
    return existing.id;
  }

  const createRes = await fetchAPI('', 'POST', {
    title: title || 'Untitled',
    description: '',
    urlId,
  });

  if (!createRes || !createRes.ok) return null;

  const created = await createRes.json();
  const id = created.workspace?.id;

  if (id) {
    syncCache[urlId] = id;
  }

  return id || null;
}

export async function syncMessagesToServer(
  urlId: string,
  messages: Message[],
  snapshot: Snapshot | null,
  title?: string,
): Promise<void> {
  if (!isLoggedIn()) return;

  const workspaceId = await getOrCreateWorkspace(urlId, title);
  if (!workspaceId) return;

  const storableMessages = messages
    .filter((m) => !m.annotations?.includes('no-store'))
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      annotations: m.annotations || [],
    }));

  await fetchAPI(`/${workspaceId}`, 'PUT', {
    title: title || undefined,
    messages: storableMessages,
    snapshot: snapshot || undefined,
  });
}

export async function loadWorkspaceFromServer(urlId: string): Promise<{
  messages: Message[];
  snapshot: Snapshot | null;
  title: string;
} | null> {
  if (!isLoggedIn()) return null;

  const listRes = await fetchAPI('', 'GET');
  if (!listRes || !listRes.ok) return null;

  const data = await listRes.json();
  const workspace = (data.workspaces || []).find((w: any) => w.url_id === urlId);

  if (!workspace) return null;

  const detailRes = await fetchAPI(`/${workspace.id}`, 'GET');
  if (!detailRes || !detailRes.ok) return null;

  const detail = await detailRes.json();

  return {
    messages: (detail.messages || []).map((m: any, idx: number) => ({
      id: String(idx),
      role: m.role,
      content: m.content,
      annotations: m.annotations || [],
    })),
    snapshot: detail.snapshot || null,
    title: workspace.title,
  };
}

export async function listUserWorkspaces(): Promise<
  Array<{ id: string; url_id: string; title: string; updated_at: string }>
> {
  if (!isLoggedIn()) return [];

  const res = await fetchAPI('', 'GET');
  if (!res || !res.ok) return [];

  const data = await res.json();
  return data.workspaces || [];
}

export function clearSyncCache(): void {
  syncCache = {};
}
