/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MarketingEventKey, PublicMarketingIntegrations } from "@/lib/marketing-integrations";

type OptionalCookieCategory = "functional" | "analytics" | "marketing";

type CookieConsentState = Record<OptionalCookieCategory, boolean> & {
  necessary: true;
  updatedAt: string;
};

type MarketingPayload = {
  event: MarketingEventKey | string;
  value?: number;
  currency?: string;
  contentIds?: Array<string | number>;
  contentName?: string;
  contentCategory?: string;
  quantity?: number;
  orderId?: string | number;
  [key: string]: unknown;
};

const COOKIE_NAME = "zlatevi_cookie_consent";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) return null;
  try {
    const value = match.slice(name.length + 1);
    return value.trim() ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

function safeJson<T = unknown>(value: string | null | undefined): T | null {
  if (!value || !value.trim()) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function safeResponseJson(response: Response): Promise<any | null> {
  const text = await response.text().catch(() => "");
  return safeJson(text);
}

function parseConsent(): CookieConsentState | null {
  const raw = readCookie(COOKIE_NAME) || (typeof localStorage !== "undefined" ? localStorage.getItem(COOKIE_NAME) : null);
  const parsed = safeJson<Partial<CookieConsentState>>(raw);
  if (!parsed) return null;

  try {
    if (!parsed || parsed.necessary !== true) return null;
    return {
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function getEventName(event: string) {
  const map: Record<string, { google: string; meta: string; tiktok: string }> = {
    pageView: { google: "page_view", meta: "PageView", tiktok: "PageView" },
    viewContent: { google: "view_item", meta: "ViewContent", tiktok: "ViewContent" },
    addToCart: { google: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart" },
    initiateCheckout: { google: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
    purchase: { google: "purchase", meta: "Purchase", tiktok: "CompletePayment" },
  };
  return map[event] ?? { google: event, meta: event, tiktok: event };
}

function insertScript(id: string, src: string, onLoad?: () => void) {
  if (document.getElementById(id)) {
    onLoad?.();
    return;
  }
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  if (onLoad) script.onload = onLoad;
  document.head.appendChild(script);
}

function insertInlineScript(id: string, code: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.textContent = code;
  document.head.appendChild(script);
}

function isGoogleTagManagerId(id: string) {
  return id.trim().toUpperCase().startsWith("GTM-");
}

function toGooglePayload(payload: MarketingPayload) {
  return {
    value: payload.value,
    currency: payload.currency || "EUR",
    items: payload.contentIds?.map((id) => ({ item_id: String(id), item_name: payload.contentName, item_category: payload.contentCategory })) ?? undefined,
    transaction_id: payload.orderId ? String(payload.orderId) : undefined,
  };
}

function toPixelPayload(payload: MarketingPayload) {
  return {
    value: payload.value,
    currency: payload.currency || "EUR",
    content_ids: payload.contentIds?.map(String),
    content_name: payload.contentName,
    content_category: payload.contentCategory,
    contents: payload.contentIds?.map((id) => ({ id: String(id), quantity: payload.quantity || 1 })) ?? undefined,
    num_items: payload.quantity,
    order_id: payload.orderId ? String(payload.orderId) : undefined,
  };
}

function providerReady(integrations: PublicMarketingIntegrations | null, key: "google" | "meta" | "tiktok", allowed: boolean) {
  const provider = integrations?.[key];
  return Boolean(allowed && provider?.enabled && provider.id.trim());
}

export default function MarketingPixelManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<PublicMarketingIntegrations | null>(null);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const loaded = useRef({ google: false, meta: false, tiktok: false });

  const queryString = searchParams.toString();
  const currentUrl = useMemo(() => `${pathname}${queryString ? `?${queryString}` : ""}`, [pathname, queryString]);

  function track(payload: MarketingPayload) {
    if (!integrations || !consent) return;
    const key = payload.event as MarketingEventKey;
    if (key in integrations.events && !integrations.events[key]) return;

    const names = getEventName(payload.event);
    if (providerReady(integrations, "google", consent.analytics)) {
      if (integrations.google.testMode) console.info("[Store marketing] Google event", names.google, payload);
      else if (isGoogleTagManagerId(integrations.google.id)) (window as any).dataLayer?.push?.({ event: names.google, ...toGooglePayload(payload) });
      else (window as any).gtag?.("event", names.google, toGooglePayload(payload));
    }
    if (providerReady(integrations, "meta", consent.marketing)) {
      if (integrations.meta.testMode) console.info("[Store marketing] Meta event", names.meta, payload);
      else (window as any).fbq?.("track", names.meta, toPixelPayload(payload));
    }
    if (providerReady(integrations, "tiktok", consent.marketing)) {
      if (integrations.tiktok.testMode) console.info("[Store marketing] TikTok event", names.tiktok, payload);
      else (window as any).ttq?.track?.(names.tiktok, toPixelPayload(payload));
    }
  }

  useEffect(() => {
    if (window.location.search.includes("visualEditorPreview=1")) return;
    setConsent(parseConsent());
    let mounted = true;
    fetch("/api/marketing-integrations", { cache: "no-store" })
      .then(async (response) => response.ok ? safeResponseJson(response) : null)
      .then((data) => { if (mounted) setIntegrations(data?.integrations ?? null); })
      .catch(() => { if (mounted) setIntegrations(null); });

    const onConsent = (event: Event) => {
      const custom = event as CustomEvent<CookieConsentState>;
      setConsent(custom.detail || parseConsent());
    };
    window.addEventListener("zlatevi-cookie-consent", onConsent);
    return () => {
      mounted = false;
      window.removeEventListener("zlatevi-cookie-consent", onConsent);
    };
  }, []);

  useEffect(() => {
    if (!integrations || !consent) return;

    if (providerReady(integrations, "google", consent.analytics) && !loaded.current.google) {
      loaded.current.google = true;
      if (integrations.google.testMode) console.info("[Store marketing] Google test mode active", integrations.google.id);
      else {
        const id = integrations.google.id.trim();
        if (isGoogleTagManagerId(id)) {
          insertInlineScript("zlatevi-google-tag-manager", `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`);
        } else {
          insertScript("zlatevi-google-tag", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
          insertInlineScript("zlatevi-google-tag-config", `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${id}', { send_page_view: false });`);
        }
      }
    }

    if (providerReady(integrations, "meta", consent.marketing) && !loaded.current.meta) {
      loaded.current.meta = true;
      if (integrations.meta.testMode) console.info("[Store marketing] Meta test mode active", integrations.meta.id);
      else {
        const id = integrations.meta.id.trim();
        insertInlineScript("zlatevi-meta-pixel", `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${id}');`);
      }
    }

    if (providerReady(integrations, "tiktok", consent.marketing) && !loaded.current.tiktok) {
      loaded.current.tiktok = true;
      if (integrations.tiktok.testMode) console.info("[Store marketing] TikTok test mode active", integrations.tiktok.id);
      else {
        const id = integrations.tiktok.id.trim();
        insertInlineScript("zlatevi-tiktok-pixel", `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement('script');o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');}(window, document, 'ttq');`);
      }
    }
  }, [integrations, consent]);

  useEffect(() => {
    if (!integrations?.events.pageView) return;
    track({ event: "pageView" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, integrations?.events.pageView, consent?.analytics, consent?.marketing]);

  useEffect(() => {
    const onTrack = (event: Event) => {
      const custom = event as CustomEvent<MarketingPayload>;
      if (custom.detail?.event) track(custom.detail);
    };
    window.addEventListener("zlatevi-track-event", onTrack);
    return () => window.removeEventListener("zlatevi-track-event", onTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrations, consent]);

  return null;
}

export function trackMarketingEvent(payload: MarketingPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MarketingPayload>("zlatevi-track-event", { detail: payload }));
}
