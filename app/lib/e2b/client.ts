import { createScopedLogger } from '~/utils/logger';
import { WORK_DIR } from '~/utils/constants';

const logger = createScopedLogger('E2BClient');

const SANDBOX_API_BASE = '/api/sandbox';

let _sandboxId: string | null = null;

function getSandboxId(): string {
  if (!_sandboxId) {
    _sandboxId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return _sandboxId;
}

function sandboxHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-sandbox-id': getSandboxId(),
  };
}

async function sandboxFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${SANDBOX_API_BASE}/${path}`, {
    ...options,
    headers: {
      ...sandboxHeaders(),
      ...(options.headers || {}),
    },
  });

  return res;
}

export interface E2BFileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface E2BExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
}

export const e2bFiles = {
  async read(filePath: string): Promise<string> {
    const res = await sandboxFetch(`files/read?path=${encodeURIComponent(filePath)}`);

    if (!res.ok) {
      throw new Error(`Failed to read file ${filePath}: ${res.statusText}`);
    }

    const { content } = (await res.json()) as { content: string };

    return content;
  },

  async write(filePath: string, content: string): Promise<void> {
    const res = await sandboxFetch('files/write', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content }),
    });

    if (!res.ok) {
      throw new Error(`Failed to write file ${filePath}: ${res.statusText}`);
    }
  },

  async mkdir(dirPath: string): Promise<void> {
    const res = await sandboxFetch('files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath }),
    });

    if (!res.ok) {
      throw new Error(`Failed to mkdir ${dirPath}: ${res.statusText}`);
    }
  },

  async list(dirPath: string): Promise<E2BFileEntry[]> {
    const res = await sandboxFetch(`files/list?path=${encodeURIComponent(dirPath)}`);

    if (!res.ok) {
      throw new Error(`Failed to list ${dirPath}: ${res.statusText}`);
    }

    const { entries } = (await res.json()) as { entries: E2BFileEntry[] };

    return entries || [];
  },

  async rm(filePath: string, opts?: { recursive?: boolean }): Promise<void> {
    const res = await sandboxFetch('files/delete', {
      method: 'DELETE',
      body: JSON.stringify({ path: filePath, recursive: opts?.recursive ?? false }),
    });

    if (!res.ok) {
      throw new Error(`Failed to delete ${filePath}: ${res.statusText}`);
    }
  },
};

export const e2bCommands = {
  async run(command: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<E2BExecResult> {
    const res = await sandboxFetch('exec', {
      method: 'POST',
      body: JSON.stringify({
        command,
        cwd: opts?.cwd || WORK_DIR,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      throw new Error(err.error || res.statusText);
    }

    return res.json();
  },

  async stream(
    command: string,
    opts: {
      cwd?: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<{ exitCode: number }> {
    const res = await sandboxFetch('exec/stream', {
      method: 'POST',
      body: JSON.stringify({
        command,
        cwd: opts.cwd || WORK_DIR,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Failed to stream command: ${res.statusText}`);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let exitCode = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }

        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'stdout' && opts.onStdout) {
            opts.onStdout(event.data);
          } else if (event.type === 'stderr' && opts.onStderr) {
            opts.onStderr(event.data);
          } else if (event.type === 'exit') {
            exitCode = event.exitCode;
          }
        } catch {}
      }
    }

    return { exitCode };
  },
};

export async function getPreviewUrl(port: number): Promise<string> {
  const res = await sandboxFetch(`preview-url?port=${port}`);

  if (!res.ok) {
    throw new Error(`Failed to get preview URL: ${res.statusText}`);
  }

  const { url } = (await res.json()) as { url: string };

  return url;
}

export function watchFiles(
  watchPath: string,
  callback: (event: { type: string; path: string; content?: string }) => void,
): () => void {
  const controller = new AbortController();
  const headers = sandboxHeaders();

  (async () => {
    try {
      const res = await fetch(
        `${SANDBOX_API_BASE}/files/watch?path=${encodeURIComponent(watchPath)}`,
        {
          headers,
          signal: controller.signal,
        },
      );

      if (!res.ok || !res.body) {
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }

          try {
            const event = JSON.parse(line.slice(6));
            callback(event);
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      logger.error('File watcher error', err);
    }
  })();

  return () => controller.abort();
}
