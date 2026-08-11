"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  decrementAdminNavAlert,
  formatAdminAlertCount,
  normalizeAdminNavAlerts,
  type AdminNavAlerts,
} from "@/lib/admin-nav-alerts";
import {
  ADMIN_NAV_ALERT_VIEWED_EVENT,
  type AdminNavAlertViewedDetail,
} from "@/lib/admin-nav-alert-client";
import {
  ADMIN_NAV_ALERTS_BROADCAST_CHANNEL,
  ADMIN_NAV_ALERTS_CHANGED_EVENT,
  ADMIN_NAV_ALERTS_STORAGE_KEY,
} from "@/lib/admin-nav-alert-live";
import {
  findActiveAdminNavHref,
  findAdminNavGroupId,
  getVisibleAdminNavGroups,
  type AdminNavItem,
} from "@/lib/admin-navigation";

import styles from "./AdminNav.module.css";
import { useI18n } from "@/components/i18n/I18nProvider";

type AdminNavProps = {
  isSuperAdmin: boolean;
  permissions?: string[];
  initialAlerts: AdminNavAlerts;
  isDesignOwner?: boolean;
};

export default function AdminNav({
  isSuperAdmin,
  permissions = [],
  initialAlerts,
  isDesignOwner = false,
}: AdminNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const sidebarRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [pendingNavigation, setPendingNavigation] = useState<{
    fromPathname: string;
    href: string;
  } | null>(null);
  const groups = useMemo(
    () => getVisibleAdminNavGroups({ isSuperAdmin, permissions, isDesignOwner }),
    [isSuperAdmin, permissions, isDesignOwner],
  );
  const activeHref = findActiveAdminNavHref(groups, pathname);
  const activeGroupId = findAdminNavGroupId(groups, activeHref);
  const pendingHref =
    pendingNavigation?.fromPathname === pathname
      ? pendingNavigation.href
      : null;
  const visualActiveHref = pendingHref ?? activeHref;
  const visualActiveGroupId = findAdminNavGroupId(groups, visualActiveHref);
  const collapsibleGroupIds = useMemo(
    () => new Set(groups.filter((group) => !group.standalone).map((group) => group.id)),
    [groups],
  );
  const [groupSelection, setGroupSelection] = useState<{
    pathname: string;
    groupId: string | null;
  } | null>(null);
  const activeCollapsibleGroup =
    activeGroupId && collapsibleGroupIds.has(activeGroupId)
      ? activeGroupId
      : null;
  const pendingGroupId = findAdminNavGroupId(groups, pendingHref ?? undefined);
  const expandedGroup =
    pendingGroupId && collapsibleGroupIds.has(pendingGroupId)
      ? pendingGroupId
      : groupSelection?.pathname === pathname
        ? groupSelection.groupId
        : activeCollapsibleGroup;

  useEffect(() => {
    if (!pendingNavigation) return;
    const timeoutId = window.setTimeout(() => setPendingNavigation(null), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [pendingNavigation]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const storageKey = "zlatevi-admin-nav-scroll";
    const savedScroll = Number(window.sessionStorage.getItem(storageKey));
    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      sidebar.scrollTop = savedScroll;
    }

    let frameId = 0;
    const rememberScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        window.sessionStorage.setItem(storageKey, String(sidebar.scrollTop));
      });
    };

    sidebar.addEventListener("scroll", rememberScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      sidebar.removeEventListener("scroll", rememberScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let refreshTimer: number | null = null;

    function clearRefreshTimer() {
      if (refreshTimer === null) return;
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    function scheduleNextRefresh() {
      clearRefreshTimer();
      if (!active || document.visibilityState === "hidden") return;
      refreshTimer = window.setTimeout(() => {
        void refreshAlerts();
      }, 5_000);
    }

    async function refreshAlerts() {
      if (document.visibilityState === "hidden" || requestInFlight) {
        scheduleNextRefresh();
        return;
      }
      requestInFlight = true;
      try {
        const response = await fetch(`/api/admin/navigation-alerts?ts=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (active) setAlerts(normalizeAdminNavAlerts(data));
      } catch {
        // Навигацията остава с последните успешно заредени стойности.
      } finally {
        requestInFlight = false;
        scheduleNextRefresh();
      }
    }

    // Не чакаме първия интервал: App Router layout-ът може да е останал монтиран
    // със стар server snapshot след клиентска навигация.
    void refreshAlerts();

    const handleFocus = () => void refreshAlerts();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshAlerts();
      else clearRefreshTimer();
    };
    const handleChanged = () => void refreshAlerts();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_NAV_ALERTS_STORAGE_KEY) void refreshAlerts();
    };

    let channel: BroadcastChannel | null = null;
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(ADMIN_NAV_ALERTS_BROADCAST_CHANNEL);
        channel.addEventListener("message", handleChanged);
      }
    } catch {
      channel = null;
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener(ADMIN_NAV_ALERTS_CHANGED_EVENT, handleChanged);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      clearRefreshTimer();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(ADMIN_NAV_ALERTS_CHANGED_EVENT, handleChanged);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        channel.removeEventListener("message", handleChanged);
        channel.close();
      }
    };
  }, []);

  useEffect(() => {
    const handleViewed = (event: Event) => {
      const detail = (event as CustomEvent<AdminNavAlertViewedDetail>).detail;
      if (!detail?.href) return;
      setAlerts((current) =>
        decrementAdminNavAlert(current, detail.href, detail.decrement),
      );
    };

    window.addEventListener(ADMIN_NAV_ALERT_VIEWED_EVENT, handleViewed);
    return () =>
      window.removeEventListener(ADMIN_NAV_ALERT_VIEWED_EVENT, handleViewed);
  }, []);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function startNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    closeMobileMenu();
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      href === pathname
    ) {
      return;
    }

    setPendingNavigation({ fromPathname: pathname, href });
    const nextGroupId = findAdminNavGroupId(groups, href);
    if (nextGroupId && collapsibleGroupIds.has(nextGroupId)) {
      setGroupSelection({ pathname: href, groupId: nextGroupId });
    } else {
      setGroupSelection({ pathname: href, groupId: expandedGroup });
    }
  }

  const labelKeys: Record<string, string> = {
    "Табло": "adminNav.overview", "Помощник": "adminNav.help", "Магазин": "adminNav.store", "Продукти": "adminNav.products",
    "Добави продукт": "adminNav.addProduct", "Стойности": "adminNav.attributes", "Маркетинг": "adminNav.marketingGroup", "Маркетинг интеграции": "adminNav.marketing", "Социални мрежи": "adminNav.socialNetworks", "Поръчки": "adminNav.orders", "Обслужване": "adminNav.customerService", "Запитвания и рекламации": "adminNav.support",
    "Наличности": "adminNav.inventory", "Размери": "adminNav.sizes", "Промокодове": "adminNav.promoCodes", "Уеб дизайн": "adminNav.design",
    "Визуален редактор": "adminNav.themeStudio",
    "Система": "adminNav.system", "QA проблеми": "adminNav.qa", "Системно здраве": "adminNav.health",
    "Потребители": "adminNav.users", "Общи условия и фирмени детайли": "adminNav.terms", "Администратори": "adminNav.admins", "Дневник": "adminNav.audit",
    "Счетоводство": "adminNav.accounting", "Вътрешно счетоводство": "adminNav.internalAccounting", "Официален отчет": "adminNav.officialAccounting"
  };
  const translateLabel = (label: string) => t(labelKeys[label] ?? "", label);

  function renderItem(item: AdminNavItem, nested = false) {
    const active = item.href === visualActiveHref;
    const current = item.href === activeHref;
    const pending = item.href === pendingHref;
    const alertCount = alerts.items[item.href] ?? 0;
    const hasAlerts = alertCount > 0;

    const className = `${nested ? styles.subLink : styles.standaloneLink} ${
      active ? styles.active : ""
    } ${pending ? styles.pending : ""} ${hasAlerts ? styles.hasAlerts : ""}`;
    const content = (
      <>
        <span className={styles.icon}>{item.icon}</span>
        <span>{translateLabel(item.label)}</span>
        {hasAlerts ? (
          <b
            className={styles.alertBadge}
            aria-label={`${alertCount} непрегледани новости`}
          >
            {formatAdminAlertCount(alertCount)}
          </b>
        ) : (
          <small>→</small>
        )}
      </>
    );

    if (item.fullReload) {
      return (
        <a
          key={item.href}
          href={item.href}
          onClick={closeMobileMenu}
          className={className}
          aria-current={current ? "page" : undefined}
          title={hasAlerts ? `${alertCount} непрегледани новости` : undefined}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={!item.newWindow}
        target={item.newWindow ? "_blank" : undefined}
        rel={item.newWindow ? "noopener noreferrer" : undefined}
        onClick={(event) => {
          if (item.newWindow) {
            closeMobileMenu();
            return;
          }
          startNavigation(event, item.href);
        }}
        className={className}
        aria-current={current ? "page" : undefined}
        aria-busy={pending || undefined}
        title={hasAlerts ? `${alertCount} непрегледани новости` : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <>
      <button
        className={styles.mobileToggle}
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          setMobileOpen(true);
        }}
        onClick={() => setMobileOpen(true)}
        aria-label="Отвори админ меню"
        aria-expanded={mobileOpen}
      >
        <span />
        <span />
        <span />
        {alerts.total > 0 ? (
          <b
            className={styles.alertBadge}
            aria-label={`${alerts.total} непрегледани администраторски новости`}
          >
            {formatAdminAlertCount(alerts.total)}
          </b>
        ) : null}
      </button>

      <button
        className={`${styles.backdrop} ${
          mobileOpen ? styles.backdropVisible : ""
        }`}
        type="button"
        onClick={closeMobileMenu}
        aria-label="Затвори админ меню"
      />

      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${
          mobileOpen ? styles.sidebarOpen : ""
        } ${pendingHref ? styles.sidebarNavigating : ""}`}
      >
        <div className={styles.brand}>
          <span>ONLINE STORE</span>
          <strong>Online Store</strong>
          <button
            className={styles.closeMobile}
            type="button"
            onClick={closeMobileMenu}
            aria-label="Затвори менюто"
          >
            ×
          </button>
        </div>

        <nav className={styles.nav} aria-label="Администраторска навигация">
          {groups.map((group) => {
            if (group.standalone) return renderItem(group.items[0]);

            const expanded = expandedGroup === group.id;
            const groupActive = visualActiveGroupId === group.id;
            const groupAlertCount = alerts.groups[group.id] ?? 0;
            const hasGroupAlerts = groupAlertCount > 0;
            const submenuId = `admin-nav-${group.id}`;

            return (
              <section
                className={`${styles.navGroup} ${
                  expanded ? styles.groupOpen : ""
                } ${groupActive ? styles.groupActive : ""} ${
                  hasGroupAlerts ? styles.groupHasAlerts : ""
                }`}
                key={group.id}
              >
                <button
                  className={styles.groupToggle}
                  type="button"
                  onClick={() =>
                    setGroupSelection({
                      pathname,
                      groupId: expanded ? null : group.id,
                    })
                  }
                  aria-expanded={expanded}
                  aria-controls={submenuId}
                  title={
                    hasGroupAlerts
                      ? `${groupAlertCount} непрегледани новости в ${translateLabel(group.label)}`
                      : undefined
                  }
                >
                  <span className={styles.groupIcon}>{group.icon}</span>
                  <span className={styles.groupLabel}>
                    {translateLabel(group.label)}
                    <small>
                      {group.items.length} {t("admin.sections")}
                      {hasGroupAlerts
                        ? ` · ${formatAdminAlertCount(groupAlertCount)} нови`
                        : ""}
                    </small>
                  </span>
                  {hasGroupAlerts ? (
                    <b
                      className={styles.alertBadge}
                      aria-label={`${groupAlertCount} непрегледани новости`}
                    >
                      {formatAdminAlertCount(groupAlertCount)}
                    </b>
                  ) : null}
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </button>

                <div
                  id={submenuId}
                  className={`${styles.submenu} ${
                    expanded ? styles.submenuOpen : ""
                  }`}
                  aria-hidden={!expanded}
                  inert={!expanded}
                >
                  <div className={styles.submenuInner}>
                    {group.items.map((item) => renderItem(item, true))}
                  </div>
                </div>
              </section>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <Link href="/">← Към магазина</Link>
          <p>{isSuperAdmin ? "Главен администратор" : "Подадминистратор"}</p>
        </div>
      </aside>
    </>
  );
}
