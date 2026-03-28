import { Sandbox } from '@e2b/code-interpreter';

const sandboxes = new Map();
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;

export async function getOrCreateSandbox(sandboxId) {
  if (sandboxes.has(sandboxId)) {
    const entry = sandboxes.get(sandboxId);
    entry.lastUsed = Date.now();
    try {
      await entry.sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
      return entry.sandbox;
    } catch {
      sandboxes.delete(sandboxId);
    }
  }

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: SANDBOX_TIMEOUT_MS,
  });

  await sandbox.commands.run(`mkdir -p /home/project && chown -R user:user /home/project || true`);

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
