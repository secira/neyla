import { Sandbox } from '@e2b/code-interpreter';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const sandboxes = new Map();
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;

const PERSIST_FILE = '/tmp/neyla-e2b-sandboxes.json';

function loadPersisted() {
  try {
    if (existsSync(PERSIST_FILE)) {
      return JSON.parse(readFileSync(PERSIST_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function savePersisted(data) {
  try {
    writeFileSync(PERSIST_FILE, JSON.stringify(data));
  } catch {}
}

function storeE2BId(customId, e2bId) {
  const data = loadPersisted();
  data[customId] = { e2bId, ts: Date.now() };
  savePersisted(data);
}

function getStoredE2BId(customId) {
  const data = loadPersisted();
  const entry = data[customId];
  if (!entry) return null;
  // Expire after 25 minutes (E2B timeout is 30 min, give 5 min buffer)
  if (Date.now() - entry.ts > 25 * 60 * 1000) {
    delete data[customId];
    savePersisted(data);
    return null;
  }
  return entry.e2bId;
}

function touchPersisted(customId) {
  const data = loadPersisted();
  if (data[customId]) {
    data[customId].ts = Date.now();
    savePersisted(data);
  }
}

export async function getOrCreateSandbox(sandboxId) {
  // 1. Try in-memory cache first
  if (sandboxes.has(sandboxId)) {
    const entry = sandboxes.get(sandboxId);
    entry.lastUsed = Date.now();
    try {
      await entry.sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
      touchPersisted(sandboxId);
      return entry.sandbox;
    } catch {
      sandboxes.delete(sandboxId);
    }
  }

  // 2. Try to reconnect to a persisted E2B sandbox (survives server restarts)
  const storedE2BId = getStoredE2BId(sandboxId);
  if (storedE2BId) {
    try {
      console.log(`[sandbox] Reconnecting to existing E2B sandbox ${storedE2BId} for ${sandboxId}`);
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        sandboxId: storedE2BId,
      });
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
      touchPersisted(sandboxId);
      sandboxes.set(sandboxId, { sandbox, lastUsed: Date.now() });
      console.log(`[sandbox] Reconnected successfully to ${storedE2BId}`);
      return sandbox;
    } catch (err) {
      console.log(`[sandbox] Reconnect failed for ${storedE2BId}:`, err.message, '— creating new sandbox');
    }
  }

  // 3. Create a fresh sandbox
  console.log(`[sandbox] Creating new E2B sandbox for ${sandboxId}`);
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: SANDBOX_TIMEOUT_MS,
  });

  await sandbox.commands.run(`mkdir -p /home/project && chown -R user:user /home/project || true`);

  // Get the E2B-assigned sandbox ID and persist it
  const e2bIdResult = await sandbox.commands.run('echo $E2B_SANDBOX_ID').catch(() => null);
  const e2bId = e2bIdResult?.stdout?.trim();
  if (e2bId) {
    storeE2BId(sandboxId, e2bId);
    console.log(`[sandbox] Created new sandbox ${e2bId} for ${sandboxId}`);
  }

  sandboxes.set(sandboxId, { sandbox, lastUsed: Date.now() });
  return sandbox;
}

export async function destroySandbox(sandboxId) {
  const entry = sandboxes.get(sandboxId);
  if (entry) {
    try {
      await entry.sandbox.kill();
    } catch {}
    sandboxes.delete(sandboxId);
  }
  // Remove from persisted store too
  const data = loadPersisted();
  delete data[sandboxId];
  savePersisted(data);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sandboxes.entries()) {
    if (now - entry.lastUsed > SANDBOX_TIMEOUT_MS) {
      entry.sandbox.kill().catch(() => {});
      sandboxes.delete(id);
    }
  }
}, 5 * 60 * 1000);
