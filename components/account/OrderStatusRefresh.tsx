"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./AccountOrders.module.css";

export default function OrderStatusRefresh({ hasActiveOrders }: { hasActiveOrders: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState("");

  function refresh() {
    startTransition(() => {
      router.refresh();
      setLastUpdated(new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }));
    });
  }

  useEffect(() => {
    if (!hasActiveOrders) return;
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  // The router is stable and the interval must only follow the active-order flag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveOrders]);

  return (
    <div className={styles.refreshControl} aria-live="polite">
      <button type="button" onClick={refresh} disabled={pending}>
        {pending ? "Обновяване…" : "Обнови статуса"}
      </button>
      <small>
        {lastUpdated
          ? `Последна проверка: ${lastUpdated}`
          : hasActiveOrders
            ? "Автоматична проверка на всеки 60 секунди"
            : "Всички поръчки са приключени"}
      </small>
    </div>
  );
}

