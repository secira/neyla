export interface OAuthResult {
  type: 'success' | 'error';
  error?: string;
}

/**
 * Opens an OAuth flow in a popup window and resolves when the popup reports
 * a result via localStorage (`oauth_result`). Listens for the cross-window
 * `storage` event and also polls localStorage as a fallback, since storage
 * events can be missed in embedded/iframe contexts.
 *
 * Resolves `null` if the popup was blocked (caller should fall back to a
 * full-page redirect) — this is signaled by the `blocked` field instead.
 */
export function openOAuthPopup(url: string): { blocked: boolean; result: Promise<OAuthResult | null> } {
  const w = 500;
  const h = 650;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  const popup = window.open(url, 'oauth_popup', `width=${w},height=${h},left=${left},top=${top},popup=yes`);

  if (!popup) {
    return { blocked: true, result: Promise.resolve(null) };
  }

  // Clear any stale result before waiting
  try {
    localStorage.removeItem('oauth_result');
  } catch {
    // ignore
  }

  const result = new Promise<OAuthResult | null>((resolve) => {
    let settled = false;

    const finish = (value: OAuthResult | null) => {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener('storage', onStorage);
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);

      try {
        localStorage.removeItem('oauth_result');
      } catch {
        // ignore
      }

      resolve(value);
    };

    const parseAndFinish = (raw: string | null) => {
      if (!raw) {
        return false;
      }

      try {
        const parsed = JSON.parse(raw) as OAuthResult;

        if (parsed && (parsed.type === 'success' || parsed.type === 'error')) {
          finish(parsed);
          return true;
        }
      } catch {
        // fall through
      }

      return false;
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'oauth_result' || !e.newValue) {
        return;
      }

      parseAndFinish(e.newValue);
    };

    window.addEventListener('storage', onStorage);

    // Poll localStorage as a safety net (storage events can be missed),
    // and detect the popup being closed without a result.
    let closedChecks = 0;

    const pollTimer = setInterval(() => {
      let raw: string | null = null;

      try {
        raw = localStorage.getItem('oauth_result');
      } catch {
        // ignore
      }

      if (parseAndFinish(raw)) {
        return;
      }

      if (popup.closed) {
        // Give localStorage a couple more ticks to land after close
        closedChecks += 1;

        if (closedChecks >= 3) {
          finish(null);
        }
      }
    }, 500);

    // Hard cap: never wait more than 5 minutes
    const timeoutTimer = setTimeout(() => finish(null), 5 * 60 * 1000);
  });

  return { blocked: false, result };
}

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Authentication failed. Please try again.',
  google_token_failed: 'Google login failed. Please try again.',
  google_failed: 'Google login failed. Please try again.',
  github_token_failed: 'GitHub login failed. Please try again.',
  github_failed: 'GitHub login failed. Please try again.',
};
