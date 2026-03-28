/**
 * WebContainer replacement — now backed by E2B sandboxes.
 * Exports a promise that resolves to an E2B shim with the same API surface.
 */

import { getE2BShim } from '~/lib/e2b/webcontainer-shim';

export interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

let _webcontainerPromise: Promise<any>;

if (!import.meta.env.SSR) {
  _webcontainerPromise =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve().then(() => {
      const shim = getE2BShim();
      webcontainerContext.loaded = true;
      return shim;
    });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = _webcontainerPromise;
  }
} else {
  _webcontainerPromise = new Promise(() => {});
}

export const webcontainer: Promise<any> = _webcontainerPromise;
