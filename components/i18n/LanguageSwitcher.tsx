/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LOCALE_META, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";
import styles from "./LanguageSwitcher.module.css";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const MENU_WIDTH = 304;
const VIEWPORT_MARGIN = 12;
const MENU_GAP = 8;

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 0,
    left: VIEWPORT_MARGIN,
    width: MENU_WIDTH,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LOCALE_META[locale];

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const availableWidth = Math.max(260, window.innerWidth - VIEWPORT_MARGIN * 2);
    const width = Math.min(MENU_WIDTH, availableWidth);
    const desiredLeft = rect.right - width;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, desiredLeft),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );

    setMenuPosition({
      top: rect.bottom + MENU_GAP,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const reposition = () => updateMenuPosition();

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const selectLocale = (_nextLocale: AppLocale) => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const menu = open && mounted ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className={styles.menu}
      role="listbox"
      aria-label={t("common.language")}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
      }}
    >
      <div className={styles.menuHeader}>
        <span>{t("common.language")}</span>
        <span className={styles.menuHint}>BG · EN · DE · FR · IT · ES</span>
      </div>
      <div className={styles.options}>
        {SUPPORTED_LOCALES.map((item) => {
          const meta = LOCALE_META[item];
          const selected = item === locale;
          return (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={selected}
              className={`${styles.option} ${selected ? styles.selected : ""}`}
              onClick={() => selectLocale(item)}
            >
              <span className={styles.optionFlag} aria-hidden="true">{meta.flag}</span>
              <span className={styles.optionText}>
                <strong>{meta.nativeName}</strong>
                <small>{meta.englishName}</small>
              </span>
              <span className={styles.optionCode}>{item.toUpperCase()}</span>
              <span className={styles.checkSlot} aria-hidden="true">
                {selected && (
                  <svg className={styles.check} viewBox="0 0 20 20">
                    <path d="m4.5 10.4 3.4 3.4 7.6-7.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${compact ? styles.compact : ""} ${open ? styles.open : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
        aria-label={t("common.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title={t("common.language")}
      >
        <span className={styles.flag} aria-hidden="true">{current.flag}</span>
        <span className={styles.currentName}>{current.nativeName}</span>
        <span className={styles.code}>{locale.toUpperCase()}</span>
        <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
