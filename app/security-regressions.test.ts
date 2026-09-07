import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getApiKeysMock } = vi.hoisted(() => ({
  getApiKeysMock: vi.fn(),
}));

vi.mock('~/lib/api/cookies', () => ({
  getApiKeysFromCookie: getApiKeysMock,
}));

import { loader as githubLoader } from './routes/api.github-user';
import { loader as netlifyUserLoader } from './routes/api.netlify-user';
import { action as supabaseAction } from './routes/api.supabase.variables';
import { action as vercelAction, loader as vercelLoader } from './routes/api.vercel-deploy';
import { loader as vercelUserLoader } from './routes/api.vercel-user';

const GITHUB_TOKEN = 'github-credential-must-not-leak';
const SUPABASE_SERVICE_ROLE = 'supabase-service-role-must-not-leak';
const VERCEL_TOKEN = 'vercel-credential-must-not-leak';
const NETLIFY_TOKEN = 'netlify-credential-must-not-leak';

const jsonRequest = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const responseBody = async (response: Response) => response.json();
const testContext = { cloudflare: {} as any };

let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  getApiKeysMock.mockReset();
  getApiKeysMock.mockReturnValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});

describe('provider response boundaries', () => {
  it('returns only safe GitHub profile fields', async () => {
    getApiKeysMock.mockReturnValue({ GITHUB_API_KEY: GITHUB_TOKEN });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          login: 'octocat',
          name: 'Octo Cat',
          avatar_url: 'https://github.com/avatar',
          html_url: 'https://github.com/octocat',
          type: 'User',
          access_token: GITHUB_TOKEN,
          token: GITHUB_TOKEN,
        }),
        { status: 200 },
      ),
    );

    const response = await githubLoader({
      request: new Request('https://app.example/api/github-user', { headers: { 'X-Forwarded-For': 'safe-test' } }),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(body).toEqual({
      login: 'octocat',
      name: 'Octo Cat',
      avatar_url: 'https://github.com/avatar',
      html_url: 'https://github.com/octocat',
      type: 'User',
    });
    expect(JSON.stringify(body)).not.toContain(GITHUB_TOKEN);
  });

  it('never returns Supabase service_role material or extra provider fields', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { name: 'anon', api_key: 'public-anon-key', created_at: 'private-metadata' },
          { name: 'service_role', api_key: SUPABASE_SERVICE_ROLE },
          { name: 'public', api_key: 'public-key' },
        ]),
        { status: 200 },
      ),
    );

    const response = await supabaseAction({
      request: jsonRequest('https://app.example/api/supabase/variables', {
        projectId: 'project-1',
        token: 'supabase-management-token',
      }),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(body).toEqual({
      apiKeys: [
        { name: 'anon', api_key: 'public-anon-key' },
        { name: 'public', api_key: 'public-key' },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(SUPABASE_SERVICE_ROLE);
    expect(JSON.stringify(body)).not.toContain('private-metadata');
  });

  it('does not accept Vercel credentials in the URL query string', async () => {
    const response = await vercelLoader({
      request: new Request(
        `https://app.example/api/vercel-deploy?projectId=project-1&token=${encodeURIComponent(VERCEL_TOKEN)}`,
      ),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Vercel is not connected. Connect Vercel in Settings and try again.' });
    expect(JSON.stringify(body)).not.toContain(VERCEL_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns only public Vercel project and deployment status', async () => {
    getApiKeysMock.mockReturnValue({ VITE_VERCEL_ACCESS_TOKEN: VERCEL_TOKEN });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'project-1', name: 'public-project', access_token: VERCEL_TOKEN }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ deployments: [{ id: 'deployment-1', state: 'READY', url: 'public-project.vercel.app' }] }),
          { status: 200 },
        ),
      );

    const response = await vercelLoader({
      request: new Request('https://app.example/api/vercel-deploy?projectId=project-1', {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      }),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(body).toEqual({
      project: { id: 'project-1', name: 'public-project', url: 'https://public-project.vercel.app' },
      deploy: { id: 'deployment-1', state: 'READY', url: 'https://public-project.vercel.app' },
    });
    expect(JSON.stringify(body)).not.toContain(VERCEL_TOKEN);
  });
});

describe('provider error boundaries', () => {
  it('keeps known credentials out of Supabase error responses and logs', async () => {
    const knownCredential = 'supabase-error-credential';
    fetchMock.mockRejectedValue(new Error(`provider failed with ${knownCredential}`));

    const response = await supabaseAction({
      request: jsonRequest('https://app.example/api/supabase/variables', {
        projectId: 'project-1',
        token: knownCredential,
      }),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch project API keys' });
    expect(JSON.stringify(body)).not.toContain(knownCredential);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(knownCredential);
  });

  it('keeps known credentials out of GitHub and Vercel error logs', async () => {
    const knownCredential = 'provider-error-credential';
    getApiKeysMock.mockReturnValue({
      GITHUB_API_KEY: knownCredential,
      VITE_VERCEL_ACCESS_TOKEN: knownCredential,
    });
    fetchMock.mockRejectedValue(new Error(`provider failed with ${knownCredential}`));

    const githubResponse = await githubLoader({
      request: new Request('https://app.example/api/github-user', { headers: { 'X-Forwarded-For': 'error-test' } }),
      context: testContext,
      params: {},
    });
    const githubBody = await responseBody(githubResponse);

    const vercelResponse = await vercelLoader({
      request: new Request('https://app.example/api/vercel-deploy?projectId=project-1', {
        headers: { Authorization: `Bearer ${knownCredential}` },
      }),
      context: testContext,
      params: {},
    });
    const vercelBody = await responseBody(vercelResponse);

    expect(githubBody).toEqual({ error: 'Failed to fetch GitHub user information' });
    expect(vercelBody).toEqual({ error: 'Failed to fetch deployment' });
    expect(JSON.stringify(githubBody)).not.toContain(knownCredential);
    expect(JSON.stringify(vercelBody)).not.toContain(knownCredential);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(knownCredential);
  });

  it('does not return provider details from Netlify or Vercel user errors', async () => {
    getApiKeysMock.mockReturnValue({
      VITE_NETLIFY_ACCESS_TOKEN: NETLIFY_TOKEN,
      VITE_VERCEL_ACCESS_TOKEN: VERCEL_TOKEN,
    });
    fetchMock.mockRejectedValue(new Error(`provider failed with ${NETLIFY_TOKEN}`));

    const netlifyResponse = await netlifyUserLoader({
      request: new Request('https://app.example/api/netlify-user', {
        headers: { 'X-Forwarded-For': 'provider-error-test' },
      }),
      context: testContext,
      params: {},
    });
    const netlifyBody = await responseBody(netlifyResponse);

    fetchMock.mockRejectedValue(new Error(`provider failed with ${VERCEL_TOKEN}`));
    const vercelResponse = await vercelUserLoader({
      request: new Request('https://app.example/api/vercel-user', {
        headers: { 'X-Forwarded-For': 'provider-error-test' },
      }),
      context: testContext,
      params: {},
    });
    const vercelBody = await responseBody(vercelResponse);

    expect(netlifyBody).toEqual({ error: 'Failed to fetch Netlify user information' });
    expect(vercelBody).toEqual({ error: 'Failed to fetch Vercel user information' });
    expect(JSON.stringify(netlifyBody)).not.toContain(NETLIFY_TOKEN);
    expect(JSON.stringify(vercelBody)).not.toContain(VERCEL_TOKEN);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(NETLIFY_TOKEN);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(VERCEL_TOKEN);
  });

  it('does not return provider-supplied Vercel deployment error details', async () => {
    const knownCredential = 'vercel-deployment-error-credential';
    getApiKeysMock.mockReturnValue({ VITE_VERCEL_ACCESS_TOKEN: knownCredential });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'project-1', name: 'public-project' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: `provider exposed ${knownCredential}` } }), { status: 400 }),
      );

    const response = await vercelAction({
      request: jsonRequest('https://app.example/api/vercel-deploy', {
        projectId: 'project-1',
        files: { 'index.html': '<h1>Safe</h1>' },
        chatId: 'chat-1',
        token: knownCredential,
      }),
      context: testContext,
      params: {},
    });
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Failed to create the Vercel deployment' });
    expect(JSON.stringify(body)).not.toContain(knownCredential);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(knownCredential);
  });
});