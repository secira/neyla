import { atom } from 'nanostores';
import { getPreviewUrl } from '~/lib/e2b/client';

declare global {
  interface Window {
    _tabId?: string;
  }
}

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

const PREVIEW_CHANNEL = 'preview-updates';
const COMMON_PORTS = [3000, 5173, 5174, 8080, 4173, 3001, 4000];
const POLL_INTERVAL = 3000;

export class PreviewsStore {
  #availablePreviews = new Map<number, PreviewInfo>();
  #broadcastChannel?: BroadcastChannel;
  #lastUpdate = new Map<string, number>();
  #refreshTimeouts = new Map<string, NodeJS.Timeout>();
  #REFRESH_DELAY = 300;
  #storageChannel?: BroadcastChannel;
  #pollingInterval: ReturnType<typeof setInterval> | null = null;

  previews = atom<PreviewInfo[]>([]);

  constructor(_webcontainerPromise?: Promise<any>) {
    this.#broadcastChannel = this.#maybeCreateChannel(PREVIEW_CHANNEL);
    this.#storageChannel = this.#maybeCreateChannel('storage-sync-channel');

    if (this.#broadcastChannel) {
      this.#broadcastChannel.onmessage = (event) => {
        const { type, previewId } = event.data;

        if (type === 'file-change') {
          const timestamp = event.data.timestamp;
          const lastUpdate = this.#lastUpdate.get(previewId) || 0;

          if (timestamp > lastUpdate) {
            this.#lastUpdate.set(previewId, timestamp);
            this.refreshPreview(previewId);
          }
        }
      };
    }

    if (this.#storageChannel) {
      this.#storageChannel.onmessage = (event) => {
        const { storage, source } = event.data;

        if (storage && source !== this._getTabId()) {
          this._syncStorage(storage);
        }
      };
    }

    if (typeof window !== 'undefined') {
      const originalSetItem = localStorage.setItem;

      localStorage.setItem = (...args) => {
        originalSetItem.apply(localStorage, args);
        this._broadcastStorageSync();
      };
    }

    this.#startPolling();
  }

  #maybeCreateChannel(name: string): BroadcastChannel | undefined {
    if (typeof globalThis === 'undefined') {
      return undefined;
    }

    const globalBroadcastChannel = (
      globalThis as typeof globalThis & {
        BroadcastChannel?: typeof BroadcastChannel;
      }
    ).BroadcastChannel;

    if (typeof globalBroadcastChannel !== 'function') {
      return undefined;
    }

    try {
      return new globalBroadcastChannel(name);
    } catch (error) {
      console.warn('[Preview] BroadcastChannel unavailable:', error);
      return undefined;
    }
  }

  #startPolling() {
    if (this.#pollingInterval || typeof window === 'undefined') {
      return;
    }

    this.#pollingInterval = setInterval(async () => {
      for (const port of COMMON_PORTS) {
        try {
          const url = await getPreviewUrl(port);

          if (url) {
            const existing = this.#availablePreviews.get(port);

            if (!existing) {
              const previewInfo: PreviewInfo = { port, ready: true, baseUrl: url };
              this.#availablePreviews.set(port, previewInfo);
              this.previews.set([...this.#availablePreviews.values()]);
              this._broadcastStorageSync();
            }
          } else if (this.#availablePreviews.has(port)) {
            this.#availablePreviews.delete(port);
            this.previews.set([...this.#availablePreviews.values()]);
          }
        } catch {
          if (this.#availablePreviews.has(port)) {
            this.#availablePreviews.delete(port);
            this.previews.set([...this.#availablePreviews.values()]);
          }
        }
      }
    }, POLL_INTERVAL);
  }

  private _getTabId(): string {
    if (typeof window !== 'undefined') {
      if (!window._tabId) {
        window._tabId = Math.random().toString(36).substring(2, 15);
      }

      return window._tabId;
    }

    return '';
  }

  private _syncStorage(storage: Record<string, string>) {
    if (typeof window !== 'undefined') {
      Object.entries(storage).forEach(([key, value]) => {
        try {
          const originalSetItem = Object.getPrototypeOf(localStorage).setItem;
          originalSetItem.call(localStorage, key, value);
        } catch (error) {
          console.error('[Preview] Error syncing storage:', error);
        }
      });

      const previews = this.previews.get();
      previews.forEach((preview) => {
        const previewId = this.getPreviewId(preview.baseUrl);

        if (previewId) {
          this.refreshPreview(previewId);
        }
      });

      if (typeof window !== 'undefined' && window.location) {
        const iframe = document.querySelector('iframe');

        if (iframe) {
          iframe.src = iframe.src;
        }
      }
    }
  }

  private _broadcastStorageSync() {
    if (typeof window !== 'undefined') {
      const storage: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }

      this.#storageChannel?.postMessage({
        type: 'storage-sync',
        storage,
        source: this._getTabId(),
        timestamp: Date.now(),
      });
    }
  }

  getPreviewId(url: string): string | null {
    try {
      const u = new URL(url);
      return u.hostname.split('.')[0] || null;
    } catch {
      return null;
    }
  }

  broadcastStateChange(previewId: string) {
    const timestamp = Date.now();
    this.#lastUpdate.set(previewId, timestamp);

    this.#broadcastChannel?.postMessage({
      type: 'state-change',
      previewId,
      timestamp,
    });
  }

  broadcastFileChange(previewId: string) {
    const timestamp = Date.now();
    this.#lastUpdate.set(previewId, timestamp);

    this.#broadcastChannel?.postMessage({
      type: 'file-change',
      previewId,
      timestamp,
    });
  }

  broadcastUpdate(url: string) {
    const previewId = this.getPreviewId(url);

    if (previewId) {
      const timestamp = Date.now();
      this.#lastUpdate.set(previewId, timestamp);

      this.#broadcastChannel?.postMessage({
        type: 'file-change',
        previewId,
        timestamp,
      });
    }
  }

  refreshPreview(previewId: string) {
    const existingTimeout = this.#refreshTimeouts.get(previewId);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      const previews = this.previews.get();
      const preview = previews.find((p) => this.getPreviewId(p.baseUrl) === previewId);

      if (preview) {
        preview.ready = false;
        this.previews.set([...previews]);

        requestAnimationFrame(() => {
          preview.ready = true;
          this.previews.set([...previews]);
        });
      }

      this.#refreshTimeouts.delete(previewId);
    }, this.#REFRESH_DELAY);

    this.#refreshTimeouts.set(previewId, timeout);
  }

  refreshAllPreviews() {
    const previews = this.previews.get();

    for (const preview of previews) {
      const previewId = this.getPreviewId(preview.baseUrl);

      if (previewId) {
        this.broadcastFileChange(previewId);
      }
    }
  }
}

let previewsStore: PreviewsStore | null = null;

export function usePreviewStore() {
  if (!previewsStore) {
    previewsStore = new PreviewsStore();
  }

  return previewsStore;
}
