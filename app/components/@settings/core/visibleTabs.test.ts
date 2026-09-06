import { describe, expect, it } from 'vitest';
import { getVisibleTabs } from './tabVisibility';
import { ALLOWED_USER_TABS, DEFAULT_TAB_CONFIG } from './constants';
import type { TabType } from './types';
import type { TabConfig } from './tabVisibility';

// ---------------------------------------------------------------------------
// ALLOWED_USER_TABS allowlist constant
// ---------------------------------------------------------------------------

describe('ALLOWED_USER_TABS allowlist', () => {
  it('contains exactly the four expected tabs', () => {
    expect(ALLOWED_USER_TABS).toEqual(['profile', 'settings', 'data', 'cloud-providers']);
  });

  it('does not include any developer-oriented tabs', () => {
    const devTabs: TabType[] = [
      'features',
      'local-providers',
      'github',
      'gitlab',
      'netlify',
      'vercel',
      'supabase',
      'notifications',
      'event-logs',
      'mcp',
    ];

    for (const tab of devTabs) {
      expect(ALLOWED_USER_TABS).not.toContain(tab);
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_TAB_CONFIG consistency
// ---------------------------------------------------------------------------

describe('DEFAULT_TAB_CONFIG', () => {
  it('marks all ALLOWED_USER_TABS as visible and window=user', () => {
    for (const tabId of ALLOWED_USER_TABS) {
      const entry = DEFAULT_TAB_CONFIG.find((t) => t.id === tabId);
      expect(entry, `${tabId} should be in DEFAULT_TAB_CONFIG`).toBeDefined();
      expect(entry?.visible).toBe(true);
      expect(entry?.window).toBe('user');
    }
  });

  it('marks non-allowed tabs as not visible', () => {
    const nonAllowed = DEFAULT_TAB_CONFIG.filter((t) => !ALLOWED_USER_TABS.includes(t.id as TabType));

    for (const entry of nonAllowed) {
      expect(entry.visible, `${entry.id} should be hidden`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// getVisibleTabs — allowlist enforcement
// ---------------------------------------------------------------------------

describe('getVisibleTabs — allowlist enforcement', () => {
  it('returns only allowed tabs from a full user config', () => {
    const userTabs: TabConfig[] = [
      { id: 'profile', visible: true, window: 'user', order: 0 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
      { id: 'data', visible: true, window: 'user', order: 2 },
      { id: 'cloud-providers', visible: true, window: 'user', order: 3 },
      { id: 'github', visible: true, window: 'user', order: 4 },
      { id: 'features', visible: true, window: 'user', order: 5 },
      { id: 'mcp', visible: true, window: 'user', order: 6 },
    ];

    const result = getVisibleTabs(userTabs);
    const ids = result.map((t) => t.id);

    expect(ids).toContain('profile');
    expect(ids).toContain('settings');
    expect(ids).toContain('data');
    expect(ids).toContain('cloud-providers');
    expect(ids).not.toContain('github');
    expect(ids).not.toContain('features');
    expect(ids).not.toContain('mcp');
  });

  it('strips a tab whose window is not "user" from the persisted list but merges it back via defaults', () => {
    // 'profile' has window='admin' so it is stripped from userTabs, but the
    // merge step sees it is missing from the allowed set and re-adds it from
    // DEFAULT_TAB_CONFIG (which has window='user', visible=true).
    const userTabs: TabConfig[] = [
      { id: 'profile', visible: true, window: 'admin', order: 0 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    const result = getVisibleTabs(userTabs);
    const ids = result.map((t) => t.id);

    expect(ids).toContain('settings');

    // profile is an allowed tab in DEFAULT_TAB_CONFIG, so the merge step
    // guarantees it always appears regardless of the bad window value.
    expect(ids).toContain('profile');
  });

  it('a tab marked not-visible in persisted config is still shown if defaults have it visible', () => {
    // 'profile' is visible=false in the persisted config so it is filtered out
    // of configured[], but the merge step adds it back because it is in
    // ALLOWED_USER_TABS and visible=true in DEFAULT_TAB_CONFIG.
    const userTabs: TabConfig[] = [
      { id: 'profile', visible: false, window: 'user', order: 0 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    const result = getVisibleTabs(userTabs);
    const ids = result.map((t) => t.id);

    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('silently ignores entries with an empty or missing id', () => {
    const userTabs = [
      { id: '', visible: true, window: 'user', order: 0 } as TabConfig,
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    expect(() => getVisibleTabs(userTabs)).not.toThrow();

    const ids = getVisibleTabs(userTabs).map((t) => t.id);
    expect(ids).toContain('settings');
    expect(ids).not.toContain('');
  });
});

// ---------------------------------------------------------------------------
// getVisibleTabs — legacy-config merge
// ---------------------------------------------------------------------------

describe('getVisibleTabs — legacy-config merge', () => {
  it('merges in missing allowed tabs that are absent from the persisted config', () => {
    // Simulate an older config that only persisted "settings" and "data"
    const legacyUserTabs: TabConfig[] = [
      { id: 'settings', visible: true, window: 'user', order: 1 },
      { id: 'data', visible: true, window: 'user', order: 2 },
    ];

    const result = getVisibleTabs(legacyUserTabs);
    const ids = result.map((t) => t.id);

    expect(ids).toContain('profile');
    expect(ids).toContain('cloud-providers');
  });

  it('does not duplicate a tab that is already in the persisted config', () => {
    const userTabs: TabConfig[] = [
      { id: 'profile', visible: true, window: 'user', order: 0 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
      { id: 'data', visible: true, window: 'user', order: 2 },
      { id: 'cloud-providers', visible: true, window: 'user', order: 3 },
    ];

    const result = getVisibleTabs(userTabs);
    const profileCount = result.filter((t) => t.id === 'profile').length;
    expect(profileCount).toBe(1);
  });

  it('returns all four allowed tabs even when the persisted config is completely empty', () => {
    const result = getVisibleTabs([]);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('profile');
    expect(ids).toContain('settings');
    expect(ids).toContain('data');
    expect(ids).toContain('cloud-providers');
  });

  it('sorts the final list by the order field', () => {
    // Persisted config with only a subset; missing tabs merged from defaults
    const userTabs: TabConfig[] = [
      { id: 'data', visible: true, window: 'user', order: 2 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    const result = getVisibleTabs(userTabs);
    const orders = result.map((t) => t.order);

    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// getVisibleTabs — malformed / null input (graceful degradation)
// ---------------------------------------------------------------------------

describe('getVisibleTabs — malformed input', () => {
  it('returns [] for null userTabs (triggers reset path in ControlPanel)', () => {
    expect(getVisibleTabs(null)).toHaveLength(0);
  });

  it('returns [] for undefined userTabs (triggers reset path in ControlPanel)', () => {
    expect(getVisibleTabs(undefined)).toHaveLength(0);
  });

  it('silently ignores entries missing the id field without throwing', () => {
    const weirdTabs = [
      { visible: true, window: 'user', order: 0 } as unknown as TabConfig,
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    expect(() => getVisibleTabs(weirdTabs)).not.toThrow();

    const ids = getVisibleTabs(weirdTabs).map((t) => t.id);
    expect(ids).toContain('settings');
  });
});

// ---------------------------------------------------------------------------
// getVisibleTabs — notifications special-case
// ---------------------------------------------------------------------------

describe('getVisibleTabs — notifications special-case', () => {
  it('excludes the notifications tab when notificationsDisabled is true', () => {
    const userTabs: TabConfig[] = [
      { id: 'notifications', visible: true, window: 'user', order: 0 },
      { id: 'settings', visible: true, window: 'user', order: 1 },
    ];

    const result = getVisibleTabs(userTabs, true);
    expect(result.map((t) => t.id)).not.toContain('notifications');
  });

  it('notifications is not in ALLOWED_USER_TABS so it is stripped regardless of the flag', () => {
    const userTabs: TabConfig[] = [{ id: 'notifications', visible: true, window: 'user', order: 0 }];
    const result = getVisibleTabs(userTabs, false);
    expect(result.map((t) => t.id)).not.toContain('notifications');
  });
});
