"use client";

export const ADMIN_NAV_ALERTS_CHANGED_EVENT = "admin-nav-alerts-changed";
export const ADMIN_NAV_ALERTS_BROADCAST_CHANNEL = "zlatevi-admin-nav-alerts";
export const ADMIN_NAV_ALERTS_STORAGE_KEY = "zlatevi-admin-nav-alerts-pulse";

export type AdminNavAlertsChangedDetail = {
  href?: string;
  at: number;
};

/**
 * Signals open admin tabs that a source feeding the navigation counters changed.
 * BroadcastChannel gives instant same-browser tab sync, localStorage covers browsers
 * without BroadcastChannel, and the window event updates the current tab.
 */
export function notifyAdminNavAlertsChanged(href?: string) {
  if (typeof window === "undefined") return;

  const detail: AdminNavAlertsChangedDetail = { href, at: Date.now() };
  window.dispatchEvent(
    new CustomEvent<AdminNavAlertsChangedDetail>(ADMIN_NAV_ALERTS_CHANGED_EVENT, {
      detail,
    }),
  );

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(ADMIN_NAV_ALERTS_BROADCAST_CHANNEL);
      channel.postMessage(detail);
      channel.close();
    }
  } catch {
    // Polling in AdminNav remains the fallback.
  }

  try {
    window.localStorage.setItem(ADMIN_NAV_ALERTS_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Storage can be unavailable in privacy modes; polling remains the fallback.
  }
}
