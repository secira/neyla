import { Router } from 'express';
import { resolve } from 'path';
import { getOrCreateSandbox, destroySandbox } from '../e2b-sandbox.js';

const router = Router();
const WORK_DIR = '/home/project';

function getSandboxId(req) {
  return req.headers['x-sandbox-id'] || 'default';
}

/**
 * Normalize a file path so it is always absolute and confined to WORK_DIR.
 * Handles:
 *   - Paths already under WORK_DIR  → returned as-is after resolving ..
 *   - Root-absolute paths (/foo)    → WORK_DIR/foo
 *   - Relative paths (foo/bar)      → WORK_DIR/foo/bar
 * Any path that after resolution escapes WORK_DIR is clamped back inside.
 */
function normalizeSandboxPath(filePath) {
  if (!filePath) return WORK_DIR;

  // If already under WORK_DIR, resolve in place to strip any ..
  let base;
  if (filePath.startsWith(WORK_DIR + '/') || filePath === WORK_DIR) {
    base = resolve(filePath);
  } else if (filePath.startsWith('/')) {
    // Root-absolute but NOT under WORK_DIR — anchor to WORK_DIR
    base = resolve(WORK_DIR + '/' + filePath.replace(/^\/+/, ''));
  } else {
    base = resolve(WORK_DIR + '/' + filePath);
  }

  // Safety clamp: if resolve() escapes WORK_DIR, anchor the resolved
  // path back under WORK_DIR by prepending (base is already absolute).
  // e.g., /eslint.config.js → /home/project/eslint.config.js
  if (!base.startsWith(WORK_DIR)) {
    base = WORK_DIR + (base.startsWith('/') ? base : '/' + base);
  }

  return base;
}

router.post('/exec', async (req, res) => {
  try {
    const { command, cwd } = req.body;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const result = await sandbox.commands.run(command, {
      cwd: cwd || '/home/project',
      timeoutMs: 60000,
    });

    res.json({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      output: result.stdout + (result.stderr ? '\n' + result.stderr : ''),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Patterns that indicate a long-running dev/preview server command.
 * These must not be awaited — they are started in the background so they
 * keep running after the HTTP response closes.
 */
const DEV_SERVER_PATTERNS = [
  /\bnpm\s+run\s+dev\b/,
  /\bnpm\s+run\s+start\b/,
  /\bnpm\s+start\b/,
  /\byarn\s+dev\b/,
  /\byarn\s+start\b/,
  /\byarn\s+run\s+(dev|start)\b/,
  /\bpnpm\s+dev\b/,
  /\bpnpm\s+start\b/,
  /\bpnpm\s+run\s+(dev|start)\b/,
  /\bvite\b/,
  /\bnpx\s+vite\b/,
  /\bnext\s+dev\b/,
  /\bnpx\s+next\s+dev\b/,
  /\bnuxt\s+dev\b/,
  /\bserve\b/,
  /\bhttp-server\b/,
  /\bnpx\s+serve\b/,
  /\bnpx\s+http-server\b/,
  /\bnode\s+.*\b(server|index|app)\.(js|cjs|mjs)\b/,
  /\bpython3?\s+-m\s+http\.server\b/,
  /\bpython3?\s+.*\b(server|app|main)\.py\b/,
  /\bruby\s+.*\b(server|app)\.rb\b/,
  /\bbun\s+(run\s+)?(dev|start)\b/,
  /\bdeno\s+run\b/,
];

function isDevServerCommand(cmd) {
  return DEV_SERVER_PATTERNS.some((re) => re.test(cmd));
}

/**
 * Split a compound command like "npm install && npm run dev" into two parts:
 * - setup: everything before the last dev-server command  (e.g. "npm install")
 * - server: the dev-server part                           (e.g. "npm run dev")
 * Returns null if no dev-server command is detected.
 */
function splitDevServerCommand(command, cwd) {
  // Break on && / ; / |
  const segments = command.split(/&&|;|\|/).map((s) => s.trim()).filter(Boolean);
  const serverIdx = segments.findIndex((s) => isDevServerCommand(s));

  if (serverIdx === -1) return null;

  const setup = segments.slice(0, serverIdx).join(' && ');
  const server = segments[serverIdx];

  return { setup, server };
}

router.post('/exec/stream', async (req, res) => {
  const { command, cwd } = req.body;
  const sandboxId = getSandboxId(req);
  const workDir = cwd || '/home/project';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch {}
  };

  try {
    const sandbox = await getOrCreateSandbox(sandboxId);
    const split = splitDevServerCommand(command, workDir);

    if (split) {
      // ── Phase 1: run setup (e.g. npm install) streaming its output ────────
      if (split.setup) {
        send({ type: 'stdout', data: `$ ${split.setup}\r\n` });

        const setupResult = await sandbox.commands.run(split.setup, {
          cwd: workDir,
          timeoutMs: 300000,
          onStdout: (data) => send({ type: 'stdout', data }),
          onStderr: (data) => send({ type: 'stderr', data }),
        });

        if (setupResult.exitCode !== 0) {
          send({ type: 'exit', exitCode: setupResult.exitCode });
          return res.end();
        }
      }

      // ── Phase 2: launch dev server in background (nohup) ──────────────────
      //
      // E2B requires the server to bind on 0.0.0.0 (not just localhost) for
      // its port-forwarding infrastructure to expose the port externally.
      // Pass --host 0.0.0.0 for Vite/npm/pnpm/yarn run dev commands, and
      // set HOST=0.0.0.0 as env var for CRA/Next.js/other frameworks.
      let serverCmd = split.server;

      if (/\b(npm|pnpm|yarn|bun)\s+run\s+(dev|start)\b/.test(serverCmd) || /\b(npx\s+)?vite\b/.test(serverCmd)) {
        // Vite and Vite-based frameworks accept --host to bind on all interfaces
        if (!/--host/.test(serverCmd)) {
          serverCmd += ' -- --host 0.0.0.0';
        }
      }

      const logFile = `${workDir}/.devserver.log`;
      // Wrap with HOST env var for CRA-style servers and clear any stale log
      const shellScript = `HOST=0.0.0.0 ${serverCmd}`;
      const bgCommand = `rm -f ${logFile}; nohup sh -c ${JSON.stringify(shellScript)} > ${logFile} 2>&1 &`;

      send({ type: 'stdout', data: `\r\n$ ${serverCmd} (starting in background…)\r\n` });

      console.log(`[exec/stream] Launching background server: ${shellScript}`);
      await sandbox.commands.run(bgCommand, { cwd: workDir, timeoutMs: 10000 });
      console.log(`[exec/stream] Background server launched`);

      // Tail the log for up to 8 s so the user sees early output, sending
      // only newly-appended content each tick.
      await new Promise((resolve) => {
        let elapsed = 0;
        let sentBytes = 0;

        const poll = setInterval(async () => {
          elapsed += 500;

          try {
            const log = await sandbox.files.read(logFile);

            if (log && log.length > sentBytes) {
              send({ type: 'stdout', data: log.slice(sentBytes) });
              sentBytes = log.length;
            }
          } catch {}

          if (elapsed >= 8000) {
            clearInterval(poll);
            resolve();
          }
        }, 500);
      });

      send({ type: 'exit', exitCode: 0 });
      return res.end();
    }

    // ── Regular (non-dev-server) streaming command ───────────────────────────
    const proc = await sandbox.commands.run(command, {
      cwd: workDir,
      timeoutMs: 300000,
      onStdout: (data) => send({ type: 'stdout', data }),
      onStderr: (data) => send({ type: 'stderr', data }),
    });

    send({ type: 'exit', exitCode: proc.exitCode });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.message });
    res.end();
  }
});

router.get('/files/read', async (req, res) => {
  try {
    const filePath = normalizeSandboxPath(req.query.path);
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const content = await sandbox.files.read(filePath);
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/files/write', async (req, res) => {
  try {
    const filePath = normalizeSandboxPath(req.body.path);
    const { content } = req.body;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    await sandbox.files.write(filePath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/files/mkdir', async (req, res) => {
  try {
    const dirPath = normalizeSandboxPath(req.body.path);
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    await sandbox.commands.run(`mkdir -p "${dirPath}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/files/list', async (req, res) => {
  try {
    const dirPath = normalizeSandboxPath(req.query.path || WORK_DIR);
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const entries = await sandbox.files.list(dirPath);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/files/delete', async (req, res) => {
  try {
    const filePath = normalizeSandboxPath(req.body.path);
    const { recursive } = req.body;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const flag = recursive ? '-rf' : '-f';
    await sandbox.commands.run(`rm ${flag} "${filePath}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Port-ready cache ─────────────────────────────────────────────────────────
// Cache verified-ready port URLs keyed by sandboxId+port so we don't
// re-probe external URLs on every poll once a port is confirmed live.
// Also cache "not ready" results briefly to avoid hammering E2B per poll.
const portReadyCache = new Map();  // `${sandboxId}:${port}` → { ts, url | null }
const PORT_READY_TTL = 3000;       // ms — how long to trust a "ready" result
const PORT_NOTREADY_TTL = 2000;    // ms — how long to trust a "not ready" result

/**
 * Check whether a port is actually serving content by fetching the
 * E2B *external* URL for that port from our own process.
 *
 * Using an external check (rather than curl inside the sandbox) avoids
 * false positives caused by E2B's code-interpreter infrastructure which
 * can have services bound on ports like 5173 before the user's dev server
 * starts.  The public E2B URL only returns a useful response when a real
 * user-owned process is listening on 0.0.0.0 inside the sandbox.
 */
async function checkPortReady(sandbox, sandboxId, portNum) {
  const key = `${sandboxId}:${portNum}`;
  const cached = portReadyCache.get(key);

  if (cached) {
    const ttl = cached.url ? PORT_READY_TTL : PORT_NOTREADY_TTL;
    if (Date.now() - cached.ts < ttl) {
      return cached.url;
    }
  }

  try {
    const host = await sandbox.getHost(portNum);
    const url = `https://${host}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let status = 0;
    try {
      const r = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      status = r.status;
    } finally {
      clearTimeout(timeout);
    }

    // Accept 2xx–4xx; reject 000/5xx (server not listening or crashing)
    const ready = status >= 200 && status < 500;
    const result = ready ? url : null;
    portReadyCache.set(key, { ts: Date.now(), url: result });
    return result;
  } catch {
    portReadyCache.set(key, { ts: Date.now(), url: null });
    return null;
  }
}

router.get('/preview-url', async (req, res) => {
  try {
    const { port } = req.query;
    const portNum = parseInt(port || '3000', 10);
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const url = await checkPortReady(sandbox, sandboxId, portNum);
    const status = url ? 200 : 0;
    console.log(`[preview-url] port=${portNum} status=${status}${url ? ` READY → ${url}` : ''}`);

    if (url) {
      return res.json({ url });
    }

    res.status(503).json({ error: 'Server not ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: return devserver log + listening ports (helps diagnose preview issues)
router.get('/debug/devserver', async (req, res) => {
  try {
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);
    const logFile = '/home/project/.devserver.log';

    const [logResult, portsResult] = await Promise.all([
      sandbox.commands.run(`cat ${logFile} 2>/dev/null || echo "(no log yet)"`, { timeoutMs: 4000 }),
      sandbox.commands.run(`ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "(ss unavailable)"`, { timeoutMs: 4000 }),
    ]);

    res.json({
      log: logResult.stdout || '',
      listeningPorts: portsResult.stdout || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/files/watch', async (req, res) => {
  try {
    const { path: watchPath } = req.query;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const watcher = await sandbox.files.watch(watchPath || '/home/project', async (event) => {
      try {
        let content;
        if (event.type === 'write') {
          try {
            content = await sandbox.files.read(event.path);
          } catch {}
        }
        res.write(`data: ${JSON.stringify({ ...event, content })}\n\n`);
      } catch {}
    });

    req.on('close', () => {
      watcher.stop().catch(() => {});
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

router.get('/files/snapshot', async (req, res) => {
  try {
    const { path: rootPath = WORK_DIR, maxFiles = '300' } = req.query;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);
    const limit = Math.min(parseInt(maxFiles) || 300, 500);
    const files = {};
    const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', 'dist', 'build', '.next', '__pycache__']);

    async function walk(dir) {
      if (Object.keys(files).length >= limit) return;
      let entries;
      try {
        entries = await sandbox.files.list(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (Object.keys(files).length >= limit) return;
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.isDir) {
          await walk(entry.path);
        } else {
          try {
            const content = await sandbox.files.read(entry.path);
            files[entry.path] = content;
          } catch {}
        }
      }
    }

    await walk(rootPath);
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/destroy', async (req, res) => {
  const sandboxId = getSandboxId(req);
  await destroySandbox(sandboxId);
  res.json({ success: true });
});

export default router;
