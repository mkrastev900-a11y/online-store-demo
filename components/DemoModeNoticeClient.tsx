"use client";

import { useEffect, useState } from "react";

import styles from "./DemoModeNotice.module.css";

const STORAGE_KEY = "online-store-demo-notice-dismissed";

export default function DemoModeNoticeClient({ ttlMinutes }: { ttlMinutes: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(sessionStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // The notice can still be dismissed even when browser storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className={styles.notice} role="status" aria-live="polite">
      <div className={styles.content}>
        <strong>Демо режим</strong>
        <span>Тестовите данни се изтриват автоматично след {ttlMinutes} минути.</span>
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={dismiss}
        aria-label="Скрий съобщението за демо режим"
        title="Скрий"
      >
        ×
      </button>
    </aside>
  );
}
