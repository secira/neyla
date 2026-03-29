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

router.post('/exec/stream', async (req, res) => {
  try {
    const { command, cwd } = req.body;
    const sandboxId = getSandboxId(req);
    const sandbox = await getOrCreateSandbox(sandboxId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const proc = await sandbox.commands.run(command, {
      cwd: cwd || '/home/project',
      timeoutMs: 300000,
      onStdout: (data) => {
        res.write(`data: ${JSON.stringify({ type: 'stdout', data })}\n\n`);
      },
      onStderr: (data) => {
        res.write(`data: ${JSON.stringify({ type: 'stderr', data })}\n\n`);
      },
    });

    res.write(`data: ${JSON.stringify({ type: 'exit', exitCode: proc.exitCode })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
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

    const url = await sandbox.getHost(parseInt(port || '3000', 10));
    res.json({ url: `https://${url}` });
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
