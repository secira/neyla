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
  /\bpnpm\s+dev\b/,
  /\bpnpm\s+start\b/,
  /\bvite\b/,
  /\bnext\s+dev\b/,
  /\bnuxt\s+dev\b/,
  /\bserve\b/,
  /\bhttp-server\b/,
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
      const logFile = `${workDir}/.devserver.log`;
      const bgCommand = `nohup sh -c ${JSON.stringify(split.server)} > ${logFile} 2>&1 &`;

      send({ type: 'stdout', data: `\r\n$ ${split.server} (starting in background…)\r\n` });

      await sandbox.commands.run(bgCommand, { cwd: workDir, timeoutMs: 10000 });

      // Tail the log for a few seconds so the user sees early output
      await new Promise((resolve) => {
        let elapsed = 0;
        const poll = setInterval(async () => {
          elapsed += 500;

          try {
            const log = await sandbox.files.read(logFile);

            if (log) {
              send({ type: 'stdout', data: log });
            }
          } catch {}

          if (elapsed >= 4000) {
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

router.get('/preview-url', async (req, res) => {
  try {
    const { port } = req.query;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    const host = await sandbox.getHost(parseInt(port || '3000', 10));
    const url = `https://${host}`;

    // Verify the sandbox port is actually accepting HTTP connections before
    // returning the URL. sandbox.getHost() always resolves even when nothing
    // is listening, so without this check the iframe shows "refused to connect".
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const probe = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timer);

      // Any HTTP response (even 4xx) means a server is up
      if (probe.status < 600) {
        return res.json({ url });
      }
    } catch {
      // Connection refused or timeout — server not ready yet
      return res.status(503).json({ error: 'Server not ready' });
    }

    res.status(503).json({ error: 'Server not ready' });
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

router.post('/destroy', async (req, res) => {
  const sandboxId = getSandboxId(req);
  await destroySandbox(sandboxId);
  res.json({ success: true });
});

export default router;
