import type { TabType } from './types';
import { ALLOWED_USER_TABS, DEFAULT_TAB_CONFIG } from './constants';

export type TabConfig = {
  id: string;
  visible: boolean;
  window: string;
  order: number;
};

/**
 * Pure function that computes which tabs should be shown in the settings panel.
 *
 * Rules (mirrors the useMemo in ControlPanel):
 * 1. Only tabs whose id is in ALLOWED_USER_TABS are ever shown.
 * 2. Notifications are hidden when notificationsDisabled is true.
 * 3. A tab must be visible=true and window='user' to be retained from the
 *    persisted config.
 * 4. Any allowed tab that is absent from the persisted config is merged in
 *    from DEFAULT_TAB_CONFIG, guarding against old configs that pre-date a tab
 *    being added to the allowlist.
 * 5. The result is sorted ascending by the `order` field.
 *
 * Returns [] when userTabs is null/undefined — callers should treat that as a
 * signal to reset the stored configuration to defaults.
 */
export function getVisibleTabs(
  userTabs: TabConfig[] | null | undefined,
  notificationsDisabled = false,
): TabConfig[] {
  if (!userTabs || !Array.isArray(userTabs)) {
    return [];
  }

  const configured = userTabs.filter((tab) => {
    if (!tab?.id || !ALLOWED_USER_TABS.includes(tab.id as TabType)) {
      return false;
    }

    if (tab.id === 'notifications' && notificationsDisabled) {
      return false;
    }

    return tab.visible && tab.window === 'user';
  });

  const presentIds = new Set(configured.map((tab) => tab.id));
  const missing = DEFAULT_TAB_CONFIG.filter(
    (tab) => ALLOWED_USER_TABS.includes(tab.id as TabType) && tab.visible && !presentIds.has(tab.id as TabType),
  );

  return [...configured, ...(missing as TabConfig[])].sort((a, b) => a.order - b.order);
}
