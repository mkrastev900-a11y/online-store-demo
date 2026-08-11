/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

function getCurrentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore<Theme>(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("zlatevi-theme-change", handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("zlatevi-theme-change", handler);
        window.removeEventListener("storage", handler);
      };
    },
    getCurrentTheme,
    (): Theme => "light",
  );

  function toggleTheme() {
    const next: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("zlatevi-theme", next);
    window.dispatchEvent(new CustomEvent("zlatevi-theme-change", { detail: next }));
  }

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleTheme: Theme = mounted ? theme : "light";
  const isDark = visibleTheme === "dark";

  return (
    <button
      type="button"
      className={`${styles.toggle} ${compact ? styles.compact : ""}`}
      onClick={toggleTheme}
      aria-label={isDark ? "Включи светъл режим" : "Включи тъмен режим"}
      title={isDark ? "Светъл режим" : "Тъмен режим"}
      aria-pressed={isDark}
      suppressHydrationWarning
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.sun}>☀</span>
        <span className={styles.moon}>☾</span>
        <span className={styles.thumb}>{isDark ? "☾" : "☀"}</span>
      </span>
      {!compact && <span className={styles.label}>{isDark ? "Светъл режим" : "Тъмен режим"}</span>}
    </button>
  );
}
