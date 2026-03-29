/**
 * E2B drop-in shim that matches the WebContainer API surface used by the app.
 * All heavy lifting is done server-side via the sandbox API routes.
 */

import { e2bFiles, e2bCommands, getPreviewUrl, watchFiles } from './client';
import { WORK_DIR, WORK_DIR_NAME } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

/**
 * Normalize a sandbox path so it is always absolute and cannot escape WORK_DIR.
 * Works in browser (no Node.js path module needed).
 *   - Relative paths  →  prepend WORK_DIR
 *   - Root paths      →  prepend WORK_DIR  (e.g. /foo → /home/project/foo)
 *   - Resolves ..     →  prevents directory traversal
 */
function resolveSandboxPath(p: string): string {
  // Build an absolute path under WORK_DIR
  const base = p.startsWith(WORK_DIR + '/') || p === WORK_DIR
    ? p
    : p.startsWith('/')
      ? `${WORK_DIR}${p}`
      : `${WORK_DIR}/${p}`;

  // Manually resolve dots (browser has no path.resolve)
  const parts = base.split('/').filter(Boolean);
  const out: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      out.pop();
    } else if (part !== '.') {
      out.push(part);
    }
  }

  const resolved = '/' + out.join('/');

  // Final clamp — if somehow still outside WORK_DIR, anchor back inside
  if (!resolved.startsWith(WORK_DIR)) {
    return WORK_DIR + resolved;
  }

  return resolved;
}

const logger = createScopedLogger('E2BShim');

type ServerReadyCallback = (port: number, url: string) => void;
type PortCallback = (port: number, type: 'open' | 'close', url: string) => void;
type PreviewMessageCallback = (message: any) => void;

const _serverReadyCallbacks: ServerReadyCallback[] = [];
const _portCallbacks: PortCallback[] = [];
const _previewMessageCallbacks: PreviewMessageCallback[] = [];
const _watchedPorts = new Set<number>();

let _pollingInterval: ReturnType<typeof setInterval> | null = null;

function startPortPolling() {
  if (_pollingInterval) {
    return;
  }

  _pollingInterval = setInterval(async () => {
    const commonPorts = [3000, 5173, 5174, 8080, 4173, 3001, 4000];

    for (const port of commonPorts) {
      try {
        const url = await getPreviewUrl(port);

        if (url && !_watchedPorts.has(port)) {
          _watchedPorts.add(port);

          for (const cb of _portCallbacks) {
            cb(port, 'open', url);
          }

          for (const cb of _serverReadyCallbacks) {
            cb(port, url);
          }
        }
      } catch {
        if (_watchedPorts.has(port)) {
          _watchedPorts.delete(port);

          for (const cb of _portCallbacks) {
            cb(port, 'close', '');
          }
        }
      }
    }
  }, 3000);
}

export class E2BContainerShim {
  readonly workdir = WORK_DIR;

  readonly fs = {
    async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
      const fullPath = resolveSandboxPath(path);
      const content = await e2bFiles.read(fullPath);

      if (encoding === 'utf-8' || encoding === 'utf8') {
        return content;
      }

      return new TextEncoder().encode(content);
    },

    async writeFile(path: string, content: string | Uint8Array): Promise<void> {
      const fullPath = resolveSandboxPath(path);
      const text = content instanceof Uint8Array ? new TextDecoder().decode(content) : content;
      await e2bFiles.write(fullPath, text);
    },

    async mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
      const fullPath = resolveSandboxPath(path);
      await e2bFiles.mkdir(fullPath);
    },

    async readdir(
      path: string,
      opts?: { withFileTypes?: boolean },
    ): Promise<string[] | Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>> {
      const fullPath = resolveSandboxPath(path);
      const entries = await e2bFiles.list(fullPath);

      if (opts?.withFileTypes) {
        return entries.map((e) => ({
          name: e.name,
          isDirectory: () => e.isDir,
          isFile: () => !e.isDir,
        }));
      }

      return entries.map((e) => e.name);
    },

    async rm(path: string, opts?: { recursive?: boolean }): Promise<void> {
      const fullPath = resolveSandboxPath(path);
      await e2bFiles.rm(fullPath, opts);
    },
  };

  async spawn(
    cmd: string,
    args: string[] = [],
    opts?: { terminal?: { cols: number; rows: number } },
  ) {
    const command = [cmd, ...args].join(' ');
    let outputBuffer = '';

    const outputWriters: WritableStreamDefaultWriter<string>[] = [];
    const outputStream = new ReadableStream<string>({
      start(controller) {
        e2bCommands
          .stream(command, {
            onStdout: (data) => {
              outputBuffer += data;
              controller.enqueue(data);
            },
            onStderr: (data) => {
              outputBuffer += data;
              controller.enqueue(data);
            },
          })
          .then(({ exitCode }) => {
            controller.close();
          })
          .catch((err) => {
            controller.error(err);
          });
      },
    });

    return {
      output: outputStream,
      exit: Promise.resolve(0),
      kill: () => {},
      resize: () => {},
      input: {
        getWriter: () => ({
          write: async () => {},
          close: async () => {},
        }),
      },
    };
  }

  on(event: 'server-ready', callback: ServerReadyCallback): void;
  on(event: 'port', callback: PortCallback): void;
  on(event: 'preview-message', callback: PreviewMessageCallback): void;
  on(event: string, callback: any): void {
    if (event === 'server-ready') {
      _serverReadyCallbacks.push(callback);
    } else if (event === 'port') {
      _portCallbacks.push(callback);
      startPortPolling();
    } else if (event === 'preview-message') {
      _previewMessageCallbacks.push(callback);
    }
  }

  async setPreviewScript(_script: string): Promise<void> {
  }

  readonly internal = {
    watchPaths: (
      opts: { include: string[]; exclude: string[]; includeContent: boolean },
      callback: (events: Array<any>) => void,
    ) => {
      const watchPath = WORK_DIR;

      const stop = watchFiles(watchPath, (event) => {
        const mapped = mapE2BEventToWatcherEvent(event);

        if (mapped) {
          callback([[mapped]]);
        }
      });

      return { stop };
    },
  };
}

function mapE2BEventToWatcherEvent(event: { type: string; path: string; content?: string }) {
  const { type, path, content } = event;

  const buf = content ? new TextEncoder().encode(content) : undefined;

  switch (type) {
    case 'write':
      return { type: 'change', path, buffer: buf };
    case 'create':
      return { type: 'add_file', path, buffer: buf };
    case 'remove':
      return { type: 'remove_file', path };
    case 'rename':
      return { type: 'change', path, buffer: buf };
    default:
      return null;
  }
}

let _shimInstance: E2BContainerShim | null = null;

export function getE2BShim(): E2BContainerShim {
  if (!_shimInstance) {
    _shimInstance = new E2BContainerShim();
  }

  return _shimInstance;
}
