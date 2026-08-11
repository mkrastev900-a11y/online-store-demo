/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import styles from "./CookieConsent.module.css";

type OptionalCookieCategory = "functional" | "analytics" | "marketing";

type CookieConsentState = Record<OptionalCookieCategory, boolean> & {
  necessary: true;
  updatedAt: string;
};

const COOKIE_NAME = "zlatevi_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const defaultDraft: Record<OptionalCookieCategory, boolean> = {
  functional: false,
  analytics: false,
  marketing: false,
};

const categories: Array<{
  key: OptionalCookieCategory | "necessary";
  title: string;
  description: string;
  locked?: boolean;
}> = [
  {
    key: "necessary",
    title: "Задължителни",
    description: "Нужни са за основната работа на магазина — вход, количка, сигурност и запазване на избора за бисквитки.",
    locked: true,
  },
  {
    key: "functional",
    title: "Функционални",
    description: "Помнят удобства като тъмен режим, визуални настройки и предпочитания в интерфейса.",
  },
  {
    key: "analytics",
    title: "Аналитични",
    description: "Помагат да разберем кои страници и продукти се използват най-често. Не се активират без съгласие.",
  },
  {
    key: "marketing",
    title: "Маркетинг",
    description: "Използват се за реклами, пиксели и ремаркетинг. Не се активират без съгласие.",
  },
];

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

function writeConsentCookie(consent: CookieConsentState) {
  const value = encodeURIComponent(JSON.stringify(consent));
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  localStorage.setItem(COOKIE_NAME, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent("zlatevi-cookie-consent", { detail: consent }));
}

function parseConsent(): CookieConsentState | null {
  const raw = readCookie(COOKIE_NAME) || (typeof localStorage !== "undefined" ? localStorage.getItem(COOKIE_NAME) : null);
  if (!raw) return null;

  try {
    const parsed = safeJson<Partial<CookieConsentState>>(raw);
    if (!parsed || parsed.necessary !== true || typeof parsed.updatedAt !== "string") return null;

    return {
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function createConsent(values: Record<OptionalCookieCategory, boolean>): CookieConsentState {
  return {
    necessary: true,
    functional: values.functional,
    analytics: values.analytics,
    marketing: values.marketing,
    updatedAt: new Date().toISOString(),
  };
}

export default function CookieConsent() {
  const [isVisualEditorPreview, setIsVisualEditorPreview] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<Record<OptionalCookieCategory, boolean>>(defaultDraft);
  const [savedConsent, setSavedConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    const previewMode = window.location.search.includes("visualEditorPreview=1");
    setIsVisualEditorPreview(previewMode);
    if (previewMode) {
      setIsReady(true);
      return;
    }

    const existing = parseConsent();
    if (existing) {
      setSavedConsent(existing);
      setDraft({ functional: existing.functional, analytics: existing.analytics, marketing: existing.marketing });
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }

    const openSettings = () => {
      const latest = parseConsent();
      if (latest) {
        setSavedConsent(latest);
        setDraft({ functional: latest.functional, analytics: latest.analytics, marketing: latest.marketing });
      }
      setIsVisible(false);
      setIsSettingsOpen(true);
    };

    window.addEventListener("zlatevi-open-cookie-settings", openSettings);
    (window as typeof window & { openZlateviCookieSettings?: () => void }).openZlateviCookieSettings = openSettings;
    setIsReady(true);

    return () => {
      window.removeEventListener("zlatevi-open-cookie-settings", openSettings);
      delete (window as typeof window & { openZlateviCookieSettings?: () => void }).openZlateviCookieSettings;
    };
  }, []);

  const statusText = useMemo(() => {
    if (!savedConsent) return "Все още няма запазен избор.";
    const enabled = [
      savedConsent.functional ? "функционални" : null,
      savedConsent.analytics ? "аналитични" : null,
      savedConsent.marketing ? "маркетинг" : null,
    ].filter(Boolean);
    return enabled.length ? `Разрешени: ${enabled.join(", ")}.` : "Разрешени са само задължителните бисквитки.";
  }, [savedConsent]);

  function saveConsent(values: Record<OptionalCookieCategory, boolean>) {
    const consent = createConsent(values);
    writeConsentCookie(consent);
    setSavedConsent(consent);
    setDraft(values);
    setIsSettingsOpen(false);
    setIsVisible(false);
  }

  function acceptAll() {
    saveConsent({ functional: true, analytics: true, marketing: true });
  }

  function rejectOptional() {
    saveConsent({ functional: false, analytics: false, marketing: false });
  }

  function saveDraft() {
    saveConsent(draft);
  }

  function updateDraft(key: OptionalCookieCategory, value: boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  if (isVisualEditorPreview || !isReady || (!isVisible && !isSettingsOpen)) return null;

  return (
    <>
      {isVisible ? (
        <section className={styles.banner} aria-label="Настройки за бисквитки">
          <div className={styles.bannerText}>
            <span className={styles.eyebrow}>Поверителност</span>
            <h2>Използваме бисквитки</h2>
            <p>
              Задължителните бисквитки поддържат количката, профила и сигурността. С твое съгласие можем да използваме и
              функционални, аналитични и маркетинг бисквитки.
            </p>
            <Link className={styles.policyLink} href="/cookie-policy">
              Виж Cookie Policy
            </Link>
          </div>
          <div className={styles.bannerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setIsSettingsOpen(true)}>
              Настройки
            </button>
            <button type="button" className={styles.secondaryButton} onClick={rejectOptional}>
              Откажи незадължителните
            </button>
            <button type="button" className={styles.primaryButton} onClick={acceptAll}>
              Приеми всички
            </button>
          </div>
        </section>
      ) : null}

      {isSettingsOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Настройки</span>
                <h2 id="cookie-settings-title">Управление на бисквитките</h2>
                <p>{statusText}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setIsSettingsOpen(false)} aria-label="Затвори">
                ×
              </button>
            </div>

            <div className={styles.categoryList}>
              {categories.map((category) => {
                const isLocked = Boolean(category.locked);
                const checked = category.key === "necessary" ? true : draft[category.key];
                return (
                  <article key={category.key} className={styles.categoryCard}>
                    <div>
                      <h3>{category.title}</h3>
                      <p>{category.description}</p>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLocked}
                        onChange={(event) => {
                          if (category.key !== "necessary") updateDraft(category.key, event.target.checked);
                        }}
                      />
                      <span>{isLocked ? "Винаги активни" : checked ? "Включени" : "Изключени"}</span>
                    </label>
                  </article>
                );
              })}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={rejectOptional}>
                Само задължителни
              </button>
              <button type="button" className={styles.secondaryButton} onClick={saveDraft}>
                Запази избора
              </button>
              <button type="button" className={styles.primaryButton} onClick={acceptAll}>
                Приеми всички
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
