import { ADMIN_NAV_GROUPS } from "@/lib/admin-navigation";

export type AdminNavAlerts = {
  updatedAt: string;
  total: number;
  groups: Record<string, number>;
  items: Record<string, number>;
};

function safeCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function buildAdminNavAlerts(
  itemCounts: Record<string, number>,
  updatedAt = new Date().toISOString(),
): AdminNavAlerts {
  const items = Object.fromEntries(
    Object.entries(itemCounts)
      .map(([href, count]) => [href, safeCount(count)] as const)
      .filter(([, count]) => count > 0),
  );
  const groups: Record<string, number> = {};

  for (const group of ADMIN_NAV_GROUPS) {
    if (group.id === "overview") continue;
    groups[group.id] = group.items.reduce(
      (sum, item) => sum + (items[item.href] ?? 0),
      0,
    );
  }

  const total = Object.values(groups).reduce((sum, count) => sum + count, 0);
  groups.overview = total;
  items["/admin"] = total;

  return { updatedAt, total, groups, items };
}

export function normalizeAdminNavAlerts(value: unknown): AdminNavAlerts {
  if (!value || typeof value !== "object") return buildAdminNavAlerts({});
  const candidate = value as Partial<AdminNavAlerts>;
  const rawItems =
    candidate.items && typeof candidate.items === "object"
      ? candidate.items
      : {};
  return buildAdminNavAlerts(
    Object.fromEntries(
      Object.entries(rawItems).map(([href, count]) => [href, safeCount(count)]),
    ),
    typeof candidate.updatedAt === "string"
      ? candidate.updatedAt
      : new Date().toISOString(),
  );
}

export function dismissAdminNavAlert(
  alerts: AdminNavAlerts,
  href: string,
): AdminNavAlerts {
  const items = { ...alerts.items };
  delete items[href];
  delete items["/admin"];
  return buildAdminNavAlerts(items, alerts.updatedAt);
}

export function decrementAdminNavAlert(
  alerts: AdminNavAlerts,
  href: string,
  amount = 1,
): AdminNavAlerts {
  const items = { ...alerts.items };
  const nextCount = Math.max(0, (items[href] ?? 0) - safeCount(amount));
  if (nextCount > 0) items[href] = nextCount;
  else delete items[href];
  delete items["/admin"];
  return buildAdminNavAlerts(items, alerts.updatedAt);
}

export function formatAdminAlertCount(count: number) {
  return count > 99 ? "99+" : String(count);
}
