import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQuery, poolConnect } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
}));

vi.mock('../db.js', () => ({
  default: {
    query: poolQuery,
    connect: poolConnect,
  },
}));

vi.mock('../lib/projectFoundation.js', () => ({
  ensurePersonalOrganization: vi.fn().mockResolvedValue({ id: 'org-1' }),
}));

const { default: authRoutes } = await import('./auth.js');
const { default: deploymentRoutes } = await import('./deployments.js');
const { encryptCredential } = await import('../lib/credentialVault.js');
const { signToken } = await import('../middleware/auth.js');

const AGENT_TOKEN = 'agent-credential-must-not-leak';
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use('/deployments', deploymentRoutes);

let server;
let baseUrl;
let errorSpy;

const USER = {
  id: 'user-1',
  email: 'creator@example.com',
  name: 'Creator',
  avatar_url: null,
  created_at: '2026-09-07T00:00:00.000Z',
};

beforeAll(async () => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  server = await new Promise((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  errorSpy.mockRestore();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(() => {
  poolQuery.mockReset();
  poolConnect.mockReset();
  errorSpy.mockClear();
});

describe('auth response and logging boundaries', () => {
  it('does not return a JWT in signup JSON or log credential-bearing errors', async () => {
    const knownCredential = 'signup-database-error-bearer';
    poolQuery.mockImplementation(async (sql) => {
      if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
      if (sql.startsWith('INSERT INTO users')) return { rows: [USER] };
      if (sql.startsWith('INSERT INTO user_passwords')) {
        throw new Error(`database failed for ${knownCredential}`);
      }
      return { rows: [] };
    });

    const response = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'correct horse battery staple', name: USER.name }),
    });
    const output = await response.text();
    const body = JSON.parse(output);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create account' });
    expect(output).not.toContain(knownCredential);
    expect(JSON.stringify(body)).not.toMatch(/\.[\w-]+\.[\w-]+/);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(knownCredential);
  });

  it('keeps signup and login JWTs in httpOnly cookies, never in JSON', async () => {
    poolQuery.mockImplementation(async (sql) => {
      if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
      if (sql.startsWith('INSERT INTO users')) return { rows: [USER] };
      if (sql.startsWith('SELECT u.id')) {
        return { rows: [{ ...USER, password_hash: await bcrypt.hash('password-123', 4) }] };
      }
      return { rows: [] };
    });

    const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'password-123' }),
    });
    const signupBody = await signupResponse.json();
    const signupCookie = signupResponse.headers.get('set-cookie');

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USER.email, password: 'password-123' }),
    });
    const loginBody = await loginResponse.json();
    const loginCookie = loginResponse.headers.get('set-cookie');

    expect(signupResponse.status).toBe(201);
    expect(loginResponse.status).toBe(200);
    expect(signupBody).toEqual({ user: USER });
    expect(loginBody).toEqual({ user: USER });
    expect(JSON.stringify(signupBody)).not.toMatch(/\.[\w-]+\.[\w-]+/);
    expect(JSON.stringify(loginBody)).not.toMatch(/\.[\w-]+\.[\w-]+/);
    expect(signupCookie).toMatch(/neyla_token=/);
    expect(loginCookie).toMatch(/neyla_token=/);
  });
});

describe('deployment credential boundaries', () => {
  const deployment = {
    id: 'deployment-1',
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    bundle_version: 3,
    agent_token_ciphertext: encryptCredential(AGENT_TOKEN),
  };

  it('requires bearer authentication for agent endpoints and never returns the agent credential', async () => {
    poolQuery.mockResolvedValue({ rows: [deployment] });

    const queryTokenResponse = await fetch(
      `${baseUrl}/deployments/agent/${deployment.id}/poll?token=${encodeURIComponent(AGENT_TOKEN)}`,
    );
    expect(queryTokenResponse.status).toBe(401);
    expect(await queryTokenResponse.text()).not.toContain(AGENT_TOKEN);
    expect(poolQuery).not.toHaveBeenCalled();

    const bearerResponse = await fetch(`${baseUrl}/deployments/agent/${deployment.id}/poll`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
    });

    expect(bearerResponse.status).toBe(200);
    expect(await bearerResponse.json()).toEqual({ version: deployment.bundle_version });
    expect(poolQuery.mock.calls.flat().join(' ')).not.toContain(AGENT_TOKEN);
  });

  it('returns only the public deployment view without agent credentials', async () => {
    const publicDeployment = {
      id: deployment.id,
      status: 'live',
      status_detail: null,
      error: null,
      url: 'https://published.example',
      public_ip: '203.0.113.10',
      bundle_version: 3,
      deployed_version: 3,
      updated_at: '2026-09-07T00:00:00.000Z',
      created_at: '2026-09-07T00:00:00.000Z',
    };
    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'workspace-1' }] })
      .mockResolvedValueOnce({ rows: [publicDeployment] });

    const authCookie = signToken({ id: USER.id, email: USER.email, name: USER.name });
    const response = await fetch(`${baseUrl}/deployments/workspace/workspace-1`, {
      headers: { Cookie: `neyla_token=${authCookie}` },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      deployment: {
        id: publicDeployment.id,
        status: publicDeployment.status,
        statusDetail: publicDeployment.status_detail,
        error: publicDeployment.error,
        url: publicDeployment.url,
        publicIp: publicDeployment.public_ip,
        bundleVersion: publicDeployment.bundle_version,
        deployedVersion: publicDeployment.deployed_version,
        updatedAt: publicDeployment.updated_at,
        createdAt: publicDeployment.created_at,
      },
      awsConfigured: false,
    });
    expect(JSON.stringify(body)).not.toContain(AGENT_TOKEN);
    expect(body.deployment).not.toHaveProperty('agentToken');
    expect(body.deployment).not.toHaveProperty('agent_token_ciphertext');
  });

  it('requires authentication and ownership to read deployment activity', async () => {
    const unauthenticatedResponse = await fetch(`${baseUrl}/deployments/workspace/workspace-1/logs`);

    expect(unauthenticatedResponse.status).toBe(401);
    expect(poolQuery).not.toHaveBeenCalled();

    poolQuery
      .mockResolvedValueOnce({ rows: [{ id: 'workspace-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: deployment.id }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            phase: 'deployment',
            level: 'info',
            message: 'Bearer [redacted] token=[redacted]',
            created_at: '2026-09-07T00:00:00.000Z',
          },
        ],
      });

    const authCookie = signToken({ id: USER.id, email: USER.email, name: USER.name });
    const response = await fetch(`${baseUrl}/deployments/workspace/workspace-1/logs`, {
      headers: { Cookie: `neyla_token=${authCookie}` },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      logs: [
        {
          id: 1,
          phase: 'deployment',
          level: 'info',
          message: 'Bearer [redacted] token=[redacted]',
          createdAt: '2026-09-07T00:00:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(AGENT_TOKEN);
  });

  it('does not expose credential-bearing agent errors in responses or logs', async () => {
    const knownCredential = 'agent-database-error-bearer';
    poolQuery.mockRejectedValue(new Error(`database failed for ${knownCredential}`));

    const response = await fetch(`${baseUrl}/deployments/agent/${deployment.id}/poll`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Poll failed' });
    expect(JSON.stringify(body)).not.toContain(knownCredential);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(knownCredential);
  });

  it('normalizes agent status details and errors before storing them', async () => {
    const deploymentWithStatus = {
      ...deployment,
      status: 'deploying',
      status_detail: 'Downloading your app',
    };
    poolQuery
      .mockResolvedValueOnce({ rows: [deploymentWithStatus] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/deployments/agent/${deployment.id}/status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'error', error: `failed with ${AGENT_TOKEN}` }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(poolQuery.mock.calls[1][1]).toEqual(['error', null, 'The app could not be deployed', deployment.id]);
    expect(poolQuery.mock.calls.flat().join(' ')).not.toContain(AGENT_TOKEN);
  });
});