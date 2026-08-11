/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import {
  type FormEvent,
  type MouseEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CART_UPDATED_EVENT,
  EMPTY_CART_SUMMARY,
  type CartSummary,
  toCartSummary,
} from "@/lib/cart-events";
import {
  EMPTY_FAVORITE_SUMMARY,
  FAVORITES_UPDATED_EVENT,
  type FavoriteSummary,
  toFavoriteSummary,
} from "@/lib/favorite-events";
import {
  announceSupportUnreadUpdate,
  EMPTY_SUPPORT_UNREAD_SUMMARY,
  SUPPORT_UNREAD_BROADCAST_CHANNEL,
  SUPPORT_UNREAD_STORAGE_KEY,
  SUPPORT_UNREAD_UPDATED_EVENT,
  toSupportUnreadSummary,
  type SupportUnreadSummary,
  type SupportUnreadUpdatedDetail,
} from "@/lib/support-unread";
import { createHeaderScrollState, nextHeaderScrollState } from "@/lib/header-scroll";
import { PUBLIC_NAVIGATION } from "@/lib/navigation";
import styles from "./Header.module.css";
import ThemeToggle from "./ThemeToggle";
import { useI18n } from "./i18n/I18nProvider";
import { getPrimaryContactPhone } from "@/lib/site-design";
import type { PublicSocialNetworkLink } from "@/lib/social-network-types";
import { AUTH_UPDATED_EVENT, type AuthUpdatedDetail } from "@/lib/auth-events";
import { DEFAULT_STORE_NAME } from "@/lib/brand";

type NavigationItem = { href: string; label: string; visible?: boolean; openInNewTab?: boolean };
type SiteBrand = { brandName: string; logoUrl: string; darkLogoUrl: string; navigationItemsJson?: string; designTokensJson: string };

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
};


function SocialNetworkIcon({ network }: { network: PublicSocialNetworkLink["key"] }) {
  if (network === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.92 3.78-3.92 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.77l-.44 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
      </svg>
    );
  }

  if (network === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5.1" ry="5.1" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.2" cy="6.8" r="1.25" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.75 3c.36 2.94 2.05 4.72 5.02 4.91v3.35c-1.72.17-3.23-.39-4.93-1.43v6.28c0 7.98-8.7 10.48-12.2 4.75-2.25-3.68-.87-10.15 6.35-10.41v3.53c-.56.09-1.16.24-1.7.52-1.62.82-2.54 2.35-1.9 4.05 1.22 3.23 5.92 2.1 5.92-2.12V3h3.44Z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className={styles.messageIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  );
}

export default function Header({ initialSiteBrand, initialUser }: { initialSiteBrand?: SiteBrand; initialUser: CurrentUser | null }) {
  const { t, formatCurrency } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [authLoaded, setAuthLoaded] = useState(initialUser !== null);
  const siteBrand = initialSiteBrand ?? { brandName: DEFAULT_STORE_NAME, logoUrl: "", darkLogoUrl: "", designTokensJson: "{}" };
  const [pendingNavigation, setPendingNavigation] = useState<{
    fromPathname: string;
    href: string;
  } | null>(null);
  const [cartSummary, setCartSummary] = useState<CartSummary>(EMPTY_CART_SUMMARY);
  const [favoriteSummary, setFavoriteSummary] = useState<FavoriteSummary>(
    EMPTY_FAVORITE_SUMMARY,
  );
  const [supportUnreadSummary, setSupportUnreadSummary] = useState<SupportUnreadSummary>(
    EMPTY_SUPPORT_UNREAD_SUMMARY,
  );
  const [socialLinks, setSocialLinks] = useState<PublicSocialNetworkLink[]>([]);
  const [compact, setCompact] = useState(false);
  const ignoreOverlayCloseUntil = useRef(0);
  const cartRequestId = useRef(0);
  const favoritesRequestId = useRef(0);
  const supportUnreadRequestId = useRef(0);
  const cartHasItems = cartSummary.totalItems > 0;
  const cartCount = cartSummary.totalItems > 99 ? "99+" : String(cartSummary.totalItems);
  const cartTotal = formatCurrency(cartSummary.subtotal);
  const favoritesHaveItems = favoriteSummary.count > 0;
  const favoriteCount =
    favoriteSummary.count > 99 ? "99+" : String(favoriteSummary.count);
  const pendingHref =
    pendingNavigation?.fromPathname === pathname
      ? pendingNavigation.href
      : null;
  const visibleUser = user;
  const visibleAuthLoaded = authLoaded;
  const visibleIsAdmin = visibleUser?.role === "ADMIN" || visibleUser?.role === "SUPER_ADMIN";
  const visibleCustomerFirstName = visibleUser?.name?.trim().split(/\s+/)[0] || visibleUser?.email?.split("@")[0] || "Клиент";
  const visibleProfileHref = visibleUser ? "/account" : "/login";
  const visibleProfileTopLabel = visibleUser ? visibleCustomerFirstName : "Моят профил";
  const visibleProfileTitleLabel = visibleUser ? visibleCustomerFirstName : "Профил";
  const visibleProfileSubtitleLabel = visibleUser ? "Моят профил" : visibleAuthLoaded ? "Вход / Регистрация" : "Моят профил";
  const supportUnreadUserId = visibleUser?.id ?? null;
  const supportUnreadMessages = supportUnreadSummary.unreadMessages;
  const supportUnreadHasMessages = Boolean(visibleUser) && supportUnreadMessages > 0;
  const supportUnreadCount = supportUnreadMessages > 99 ? "99+" : String(supportUnreadMessages);
  const showMessageShortcut = Boolean(visibleUser);
  const messagesHref = "/contact";
  const messagesAriaLabel = supportUnreadHasMessages
    ? `Съобщения, ${supportUnreadMessages === 1 ? "1 непрочетено" : `${supportUnreadMessages} непрочетени`}`
    : "Съобщения";


  useEffect(() => {
    let active = true;
    fetch("/api/social-networks", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        setSocialLinks(Array.isArray(data?.links) ? data.links : []);
      })
      .catch(() => {
        if (active) setSocialLinks([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const visualPathname = pendingHref ?? pathname;
  const primaryPhone = getPrimaryContactPhone(siteBrand);

  useEffect(() => {
    if (!pendingNavigation) return;
    const timeoutId = window.setTimeout(() => setPendingNavigation(null), 2_500);
    return () => window.clearTimeout(timeoutId);
  }, [pendingNavigation]);

  const refreshCart = useCallback(async () => {
    const requestId = ++cartRequestId.current;
    try {
      const response = await fetch("/api/cart", { cache: "no-store", credentials: "include" });
      const data = await response.json().catch(() => null);
      if (requestId !== cartRequestId.current) return;
      setCartSummary(response.ok ? toCartSummary(data) : EMPTY_CART_SUMMARY);
    } catch {
      if (requestId === cartRequestId.current) setCartSummary(EMPTY_CART_SUMMARY);
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    const requestId = ++favoritesRequestId.current;
    try {
      const response = await fetch("/api/favorites?summary=1", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (requestId !== favoritesRequestId.current) return;
      setFavoriteSummary(
        response.ok ? toFavoriteSummary(data) : EMPTY_FAVORITE_SUMMARY,
      );
    } catch {
      if (requestId === favoritesRequestId.current) {
        setFavoriteSummary(EMPTY_FAVORITE_SUMMARY);
      }
    }
  }, []);

  const refreshSupportUnread = useCallback(async () => {
    const requestId = ++supportUnreadRequestId.current;
    if (!supportUnreadUserId) {
      setSupportUnreadSummary(EMPTY_SUPPORT_UNREAD_SUMMARY);
      return;
    }

    try {
      const response = await fetch("/api/support/unread-summary", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (requestId !== supportUnreadRequestId.current) return;
      if (response.status === 401) {
        setSupportUnreadSummary(EMPTY_SUPPORT_UNREAD_SUMMARY);
        return;
      }
      if (response.ok) {
        const summary = toSupportUnreadSummary(data);
        setSupportUnreadSummary(summary);
        announceSupportUnreadUpdate(summary);
      }
    } catch {
      // Keep the last known badge value during temporary network/API failures.
    }
  }, [supportUnreadUserId]);


  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.status === 401) {
        setUser(null);
        setAuthLoaded(true);
        return;
      }
      if (!response.ok) throw new Error("auth-request-failed");
      const data = await response.json();
      setUser(data?.user ?? null);
      setAuthLoaded(true);
    } catch {
      // При временна мрежова/сървърна грешка пазим последното валидно състояние.
      setAuthLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [pathname, refreshAuth]);

  useEffect(() => {
    function onAuthUpdated(event: Event) {
      const detail = (event as CustomEvent<AuthUpdatedDetail>).detail;
      if (detail && Object.prototype.hasOwnProperty.call(detail, "user")) {
        setUser(detail.user ?? null);
        setAuthLoaded(true);
      }
      // Потвърждаваме и от сървъра, за да остане cookie/DB състоянието source of truth.
      void refreshAuth();
    }

    function onPageShow() {
      void refreshAuth();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshAuth();
    }

    window.addEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshAuth]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshCart();
      void refreshFavorites();
    });
  }, [refreshCart, refreshFavorites]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (supportUnreadUserId) {
        void refreshSupportUnread();
        return;
      }

      supportUnreadRequestId.current += 1;
      setSupportUnreadSummary(EMPTY_SUPPORT_UNREAD_SUMMARY);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshSupportUnread, supportUnreadUserId]);

  useEffect(() => {
    function onCartUpdated(event: Event) {
      cartRequestId.current += 1;
      setCartSummary(toCartSummary((event as CustomEvent<CartSummary>).detail));
    }

    function onPageShow() {
      void refreshCart();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshCart();
    }

    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshCart]);

  useEffect(() => {
    function onFavoritesUpdated(event: Event) {
      favoritesRequestId.current += 1;
      setFavoriteSummary(
        toFavoriteSummary((event as CustomEvent<FavoriteSummary>).detail),
      );
    }

    function onPageShow() {
      void refreshFavorites();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshFavorites();
    }

    window.addEventListener(FAVORITES_UPDATED_EVENT, onFavoritesUpdated);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, onFavoritesUpdated);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshFavorites]);

  useEffect(() => {
    if (!supportUnreadUserId) return;

    function applySupportUnreadDetail(detail: unknown) {
      const next = detail && typeof detail === "object" ? detail as Partial<SupportUnreadUpdatedDetail> : null;
      if (next?.hasSummary) {
        supportUnreadRequestId.current += 1;
        setSupportUnreadSummary(toSupportUnreadSummary(next));
        return;
      }
      void refreshSupportUnread();
    }

    function onSupportUnreadUpdated(event: Event) {
      applySupportUnreadDetail((event as CustomEvent<SupportUnreadUpdatedDetail>).detail);
    }

    function onPageShow() {
      void refreshSupportUnread();
    }

    function onFocus() {
      if (document.visibilityState !== "hidden") void refreshSupportUnread();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshSupportUnread();
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== SUPPORT_UNREAD_STORAGE_KEY || !event.newValue) return;
      try {
        applySupportUnreadDetail(JSON.parse(event.newValue));
      } catch {
        void refreshSupportUnread();
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refreshSupportUnread();
    }, 15_000);
    let channel: BroadcastChannel | null = null;
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(SUPPORT_UNREAD_BROADCAST_CHANNEL);
        channel.onmessage = (event) => applySupportUnreadDetail(event.data);
      }
    } catch {
      channel = null;
    }

    window.addEventListener(SUPPORT_UNREAD_UPDATED_EVENT, onSupportUnreadUpdated);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      channel?.close();
      window.removeEventListener(SUPPORT_UNREAD_UPDATED_EVENT, onSupportUnreadUpdated);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSupportUnread, supportUnreadUserId]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    let scrollState = createHeaderScrollState(window.scrollY);
    let renderedCompact = scrollState.compact;
    let ticking = false;
    let frameId = 0;

    function update() {
      scrollState = nextHeaderScrollState(
        scrollState,
        window.scrollY,
        window.innerWidth > 1180,
        performance.now(),
      );
      if (renderedCompact !== scrollState.compact) {
        renderedCompact = scrollState.compact;
        setCompact(renderedCompact);
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        frameId = window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  let configuredNavigation: NavigationItem[] = [...PUBLIC_NAVIGATION];
  try {
    const parsed = JSON.parse(siteBrand.navigationItemsJson || "[]");
    if (Array.isArray(parsed) && parsed.length) configuredNavigation = parsed.filter((item) => item && item.visible !== false && typeof item.href === "string" && typeof item.label === "string");
  } catch {}
  const publicLabelKeys: Record<string, string> = {"/":"nav.home","/women":"nav.women","/men":"nav.men","/kids":"nav.kids","/new":"nav.new","/sale":"nav.sale","/contact":"nav.contact","/about":"nav.about"};
  configuredNavigation = configuredNavigation.map((item) => ({ ...item, label: publicLabelKeys[item.href] ? t(publicLabelKeys[item.href], item.label) : item.label }));
  const dedupedNavigation = configuredNavigation.filter((item, index, list) =>
    list.findIndex((candidate) => candidate.href === item.href && candidate.label === item.label) === index,
  );
  const navigation: NavigationItem[] = visibleIsAdmin && !dedupedNavigation.some((item) => item.href === "/admin")
    ? [...dedupedNavigation, { href: "/admin", label: t("nav.admin"), visible: true }]
    : dedupedNavigation;
  const navigationFitStyle = {
    "--nav-items-count": navigation.length,
  } as CSSProperties;

  function openMenu() {
    ignoreOverlayCloseUntil.current = Date.now() + 350;
    setMenuOpen(true);
  }

  function closeMenuFromOverlay() {
    if (Date.now() < ignoreOverlayCloseUntil.current) return;
    setMenuOpen(false);
  }

  function startNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    setMenuOpen(false);
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
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const href = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
    setMenuOpen(false);
    setPendingNavigation({ fromPathname: pathname, href: "/search" });
    router.push(href);
  }

  function isNavigationActive(href: string) {
    if (href === "/") return visualPathname === "/";
    return visualPathname === href || visualPathname.startsWith(`${href}/`);
  }

  function isContactNavigationItem(href: string) {
    return href === "/contact" || href.startsWith("/contact?") || href.startsWith("/contact#");
  }

  function navigationAriaLabel(item: NavigationItem) {
    if (!isContactNavigationItem(item.href) || !supportUnreadHasMessages) return undefined;
    const unreadLabel = supportUnreadMessages === 1 ? "1 непрочетено съобщение" : `${supportUnreadMessages} непрочетени съобщения`;
    return `${item.label}, ${unreadLabel}`;
  }

  return (
    <>
      <header className={`${styles.header} ${compact ? styles.compactHeader : ""} ${pendingHref ? styles.headerNavigating : ""}`} suppressHydrationWarning>
        <div className={styles.utilityBar}>
          <div className={styles.utilityInner}>
            <div className={styles.utilityLeft}>
              <span>▱ Безплатна доставка над 120 €</span>
              <i>†</i>
              <span>↻ 14 дни право на връщане</span>
            </div>
            <div className={styles.utilityCenter} aria-label="Социални мрежи">
              {socialLinks.map((link) => (
                <a
                  key={link.key}
                  className={styles.socialIcon}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  aria-label={link.label}
                >
                  <SocialNetworkIcon network={link.key} />
                </a>
              ))}
            </div>
            <div className={styles.utilityRight}>
              <ThemeToggle />
              {primaryPhone ? <a href={`tel:${primaryPhone.replace(/[^\d+]/g, "")}`}>☎ {primaryPhone}</a> : null}
              <Link data-no-text-editor href={visibleProfileHref} onClick={(event) => startNavigation(event, visibleProfileHref)}>♙ {visibleProfileTopLabel}</Link>
              <Link
                href="/favorites"
                className={favoritesHaveItems ? styles.utilityFavoriteActive : ""}
                onClick={(event) => startNavigation(event, "/favorites")}
              >
                {favoritesHaveItems ? "♥" : "♡"} Любими
                {favoritesHaveItems ? ` (${favoriteCount})` : ""}
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.mainBar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Отвори менюто"
            onClick={(event) => {
              event.stopPropagation();
              openMenu();
            }}
            onTouchEnd={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openMenu();
            }}
          >
            <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 6.5h16M4 12h16M4 17.5h16" />
            </svg>
          </button>

          {siteBrand.logoUrl ? (
            <Link href="/" className={styles.logoLink} aria-label={siteBrand.brandName} onClick={(event) => startNavigation(event, "/")}>
              <Image
                src={siteBrand.logoUrl}
                alt={siteBrand.brandName}
                width={520}
                height={214}
                priority
                className={styles.logo}
              />
            </Link>
          ) : (
            <Link href="/" className={styles.logoLink} aria-label={siteBrand.brandName} onClick={(event) => startNavigation(event, "/")}>
              <span className={styles.logoTextFallback}>{siteBrand.brandName}</span>
            </Link>
          )}

          <form className={styles.search} action="/search" onSubmit={submitSearch}>
            <input name="q" placeholder="Търси продукти..." aria-label="Търси продукти" />
            <button type="submit" aria-label="Търси">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
            </button>
          </form>

          <div className={styles.mainActions}>
            <Link
              href="/favorites"
              className={`${styles.actionItem} ${favoritesHaveItems ? styles.favoriteActive : ""}`}
              aria-label={`Любими: ${favoriteSummary.count} запазени артикула`}
              onClick={(event) => startNavigation(event, "/favorites")}
            >
              <span className={styles.iconCircle}>
                {favoritesHaveItems ? "♥" : "♡"}
                {favoritesHaveItems && (
                  <span key={favoriteCount} className={styles.favoriteBadge}>
                    {favoriteCount}
                  </span>
                )}
              </span>
              <div>
                <strong>Любими</strong>
                <small aria-live="polite">
                  {favoritesHaveItems
                    ? `${favoriteSummary.count} запазени`
                    : "Запазени артикули"}
                </small>
              </div>
            </Link>
            {showMessageShortcut ? (
              <Link
                href={messagesHref}
                className={`${styles.actionItem} ${supportUnreadHasMessages ? styles.messageActive : ""}`}
                aria-label={messagesAriaLabel}
                onClick={(event) => startNavigation(event, messagesHref)}
              >
                <span className={styles.iconCircle}>
                  <MessageIcon />
                  {supportUnreadHasMessages ? <span key={supportUnreadCount} className={styles.messageBadge}>{supportUnreadCount}</span> : null}
                </span>
                <div>
                  <strong>Съобщения</strong>
                  <small aria-live="polite">{supportUnreadHasMessages ? `${supportUnreadMessages} нови` : "Моите разговори"}</small>
                </div>
              </Link>
            ) : null}
            <Link data-no-text-editor href={visibleProfileHref} className={styles.actionItem} onClick={(event) => startNavigation(event, visibleProfileHref)}>
              <span className={styles.iconCircle}>♙</span>
              <div><strong>{visibleProfileTitleLabel}</strong><small>{visibleProfileSubtitleLabel}</small></div>
            </Link>
            <Link
              href="/cart"
              className={`${styles.actionItem} ${cartHasItems ? styles.cartActive : ""}`}
              aria-label={`Количка: ${cartSummary.totalItems} артикула, ${cartTotal}`}
              onClick={(event) => startNavigation(event, "/cart")}
            >
              <span className={styles.iconCircle}>
                ▱
                {cartHasItems && <span key={cartCount} className={styles.cartBadge}>{cartCount}</span>}
              </span>
              <div><strong>Количка</strong><small className={styles.cartTotal} aria-live="polite">{cartTotal}</small></div>
            </Link>
          </div>
        </div>

        <nav className={styles.desktopNav} aria-label="Главна навигация" style={navigationFitStyle}>
          {navigation.map((item, index) => (
            <Link
              key={`${item.href}-${item.label}-${index}`}
              href={item.href}
              prefetch
              className={`${isNavigationActive(item.href) ? styles.activeLink : ""} ${pendingHref === item.href ? styles.linkPending : ""}`}
              onClick={(event) => startNavigation(event, item.href)}
              aria-current={pathname === item.href ? "page" : undefined}
              aria-busy={pendingHref === item.href || undefined}
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
              aria-label={navigationAriaLabel(item)}
              data-unread={isContactNavigationItem(item.href) && supportUnreadHasMessages ? "true" : undefined}
            >
              <span className={styles.navText}>{item.label}</span>
              {isContactNavigationItem(item.href) && supportUnreadHasMessages ? (
                <span key={supportUnreadCount} className={styles.navUnreadBadge} aria-live="polite">
                  {supportUnreadCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </header>

      <div className={styles.headerSpacer} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.overlay} ${menuOpen ? styles.overlayVisible : ""}`}
        aria-label="Затвори менюто"
        onClick={(event) => {
          event.stopPropagation();
          closeMenuFromOverlay();
        }}
      />

      <aside className={`${styles.mobileDrawer} ${menuOpen ? styles.mobileDrawerOpen : ""}`}>
        <div className={styles.drawerTop}>
          {siteBrand.logoUrl ? <Image src={siteBrand.logoUrl} alt={siteBrand.brandName} width={300} height={124} /> : <strong>{siteBrand.brandName}</strong>}
          <button type="button" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <form className={styles.mobileSearch} action="/search" onSubmit={submitSearch}>
          <input name="q" placeholder="Търси продукти..." />
          <button type="submit">⌕</button>
        </form>
        <nav className={styles.mobileNav}>
          {navigation.map((item, index) => (
            <Link
              key={`${item.href}-${item.label}-${index}`}
              href={item.href}
              prefetch
              className={`${isNavigationActive(item.href) ? styles.mobileActive : ""} ${pendingHref === item.href ? styles.mobilePending : ""}`}
              onClick={(event) => startNavigation(event, item.href)}
              aria-current={pathname === item.href ? "page" : undefined}
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
              aria-label={navigationAriaLabel(item)}
              data-unread={isContactNavigationItem(item.href) && supportUnreadHasMessages ? "true" : undefined}
            >
              <span className={styles.mobileNavLabel}>
                <span>{item.label}</span>
                {isContactNavigationItem(item.href) && supportUnreadHasMessages ? (
                  <span key={supportUnreadCount} className={styles.mobileNavUnreadBadge} aria-live="polite">
                    {supportUnreadCount}
                  </span>
                ) : null}
              </span>
              <span className={styles.mobileNavArrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
        <div className={styles.drawerTheme}><ThemeToggle /></div>
        {socialLinks.length ? (
          <div className={styles.drawerSocialLinks} aria-label="Социални мрежи">
            {socialLinks.map((link) => (
              <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
                <SocialNetworkIcon network={link.key} />
              </a>
            ))}
          </div>
        ) : null}
        <div className={styles.drawerLinks}>
          <Link href="/favorites" className={styles.drawerFavoriteLink} onClick={(event) => startNavigation(event, "/favorites")}>
            <span>{favoritesHaveItems ? "♥" : "♡"} Любими</span>
            {favoritesHaveItems && (
              <b key={favoriteCount} className={styles.drawerFavoriteCount}>
                {favoriteCount}
              </b>
            )}
          </Link>
          {showMessageShortcut ? (
            <Link href={messagesHref} className={styles.drawerMessageLink} aria-label={messagesAriaLabel} onClick={(event) => startNavigation(event, messagesHref)}>
              <span><MessageIcon /> Съобщения</span>
              {supportUnreadHasMessages ? <b key={supportUnreadCount} className={styles.drawerMessageCount}>{supportUnreadCount}</b> : null}
            </Link>
          ) : null}
          <Link data-no-text-editor href={visibleProfileHref} onClick={(event) => startNavigation(event, visibleProfileHref)}>♙ {visibleProfileTitleLabel}</Link>
          <Link href="/cart" className={styles.drawerCartLink} onClick={(event) => startNavigation(event, "/cart")}>
            <span>▱ Количка</span>
            {cartHasItems && <b key={cartCount} className={styles.drawerCartCount}>{cartCount}</b>}
            <small aria-live="polite">{cartTotal}</small>
          </Link>
        </div>
      </aside>
    </>
  );
}
