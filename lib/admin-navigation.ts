export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  permission?: string;
  superAdminOnly?: boolean;
  newWindow?: boolean;
  fullReload?: boolean;
  alwaysVisible?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: string;
  standalone?: boolean;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview", label: "Табло", icon: "⌂", standalone: true,
    items: [{ href: "/admin", label: "Табло", icon: "⌂", exact: true, permission: "DASHBOARD:VIEW" }],
  },
  {
    id: "store", label: "Магазин", icon: "◇",
    items: [
      { href: "/admin/products", label: "Продукти", icon: "◇", permission: "PRODUCTS:VIEW" },
      { href: "/admin/products/new", label: "Добави продукт", icon: "+", permission: "PRODUCTS:CREATE" },
      { href: "/admin/catalog-categories", label: "Категории", icon: "▤", permission: "PRODUCTS:VIEW" },
      { href: "/admin/product-attributes", label: "Стойности", icon: "◫", permission: "PRODUCTS:VIEW" },
      { href: "/admin/orders", label: "Поръчки", icon: "□", permission: "ORDERS:VIEW" },
      { href: "/admin/inventory", label: "Наличности", icon: "▦", permission: "INVENTORY:VIEW" },
      { href: "/admin/sizes", label: "Размери", icon: "↔", permission: "PRODUCTS:VIEW" },
      { href: "/admin/promo-codes", label: "Промокодове", icon: "%", permission: "PRODUCTS:VIEW" },
    ],
  },
  {
    id: "marketing", label: "Маркетинг", icon: "◎",
    items: [
      { href: "/admin/marketing-integrations", label: "Маркетинг интеграции", icon: "◎", permission: "PRODUCTS:VIEW" },
      { href: "/admin/social-networks", label: "Социални мрежи", icon: "☍", permission: "PRODUCTS:VIEW" },
    ],
  },
  {
    id: "customer-service", label: "Обслужване", icon: "✉",
    items: [
      { href: "/admin/support", label: "Запитвания и рекламации", icon: "✉", permission: "ORDERS:VIEW" },
    ],
  },
  {
    id: "accounting", label: "Счетоводство", icon: "€",
    items: [
      { href: "/admin/accounting", label: "Вътрешно счетоводство", icon: "€", exact: true, permission: "ACCOUNTING:VIEW" },
      { href: "/admin/accounting/official", label: "Официален отчет", icon: "▤", permission: "ACCOUNTING:VIEW", fullReload: true },
    ],
  },
  {
    id: "design", label: "Уеб дизайн", icon: "✦",
    items: [
      { href: "/visual-editor", label: "Визуален редактор", icon: "✦", permission: "WEB_DESIGN:VIEW", newWindow: true },
    ],
  },
  {
    id: "system", label: "Система", icon: "⚙",
    items: [
      { href: "/admin/system-health", label: "Системно здраве", icon: "✦", permission: "SYSTEM_HEALTH:VIEW" },
      { href: "/admin/users", label: "Потребители", icon: "♧", permission: "CUSTOMERS:VIEW" },
      { href: "/admin/legal-settings", label: "Общи условия и фирмени детайли", icon: "§", permission: "LEGAL_SETTINGS:VIEW" },
      { href: "/admin/administrators", label: "Администратори", icon: "♙", permission: "ADMINISTRATORS:VIEW" },
      { href: "/admin/audit-log", label: "Дневник", icon: "◷", permission: "AUDIT_LOG:VIEW" },
    ],
  },
  {
    id: "help", label: "Помощник", icon: "?", standalone: true,
    items: [{ href: "/admin/help", label: "Помощник", icon: "?", exact: true, alwaysVisible: true }],
  },
];

export function getVisibleAdminNavGroups({
  isSuperAdmin,
  permissions,
  isDesignOwner = false,
}: {
  isSuperAdmin: boolean;
  permissions: readonly string[];
  isDesignOwner?: boolean;
}) {
  const hasDesignAccess = isSuperAdmin || isDesignOwner || permissions.includes("WEB_DESIGN:VIEW");
  return ADMIN_NAV_GROUPS.filter((group) => group.id !== "design" || hasDesignAccess).map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.superAdminOnly) return isSuperAdmin;
      if (item.alwaysVisible) return true;
      if (isSuperAdmin) return true;
      return Boolean(item.permission && permissions.includes(item.permission));
    }),
  })).filter((group) => group.items.length > 0);
}

export function findActiveAdminNavHref(
  groups: readonly AdminNavGroup[],
  pathname: string,
) {
  return groups
    .flatMap((group) => group.items)
    .filter((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function findAdminNavGroupId(
  groups: readonly AdminNavGroup[],
  href: string | undefined,
) {
  if (!href) return undefined;
  return groups.find((group) =>
    group.items.some((item) => item.href === href),
  )?.id;
}
