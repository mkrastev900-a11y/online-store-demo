"use client";

export const ADMIN_NAV_ALERT_VIEWED_EVENT = "admin-nav-alert-viewed";

export type AdminNavAlertViewedDetail = {
  href: string;
  decrement: number;
};

export function dispatchAdminNavAlertViewed(href: string, decrement = 1) {
  window.dispatchEvent(
    new CustomEvent<AdminNavAlertViewedDetail>(
      ADMIN_NAV_ALERT_VIEWED_EVENT,
      { detail: { href, decrement } },
    ),
  );
}

export async function markAdminNavAlertItemViewed(input: {
  href: string;
  itemKey: string;
  eventVersion: string;
}) {
  const response = await fetch("/api/admin/navigation-alerts", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return false;

  const payload: unknown = await response.json();
  const newlyViewed = Boolean(
    payload &&
      typeof payload === "object" &&
      "newlyViewed" in payload &&
      payload.newlyViewed,
  );
  if (newlyViewed) dispatchAdminNavAlertViewed(input.href);
  return newlyViewed;
}


export async function markAdminNavAlertItemsViewedBatch(input: {
  items: Array<{ href: string; itemKey: string; eventVersion: string }>;
}) {
  if (!input.items.length) return 0;
  const response = await fetch("/api/admin/navigation-alerts", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: input.items }),
  });
  if (!response.ok) return 0;
  const payload: unknown = await response.json();
  const count =
    payload && typeof payload === "object" && "newlyViewedCount" in payload
      ? Number(payload.newlyViewedCount)
      : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safeCount) {
    const href = input.items[0]?.href;
    if (href) dispatchAdminNavAlertViewed(href, safeCount);
  }
  return safeCount;
}
