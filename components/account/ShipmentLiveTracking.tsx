"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShipmentTracking } from "@/lib/shipping/types";
import styles from "./AccountOrders.module.css";

type Props = {
  orderId: number;
  provider: "ECONT" | "SPEEDY";
  shipmentNumber: string;
  initialStatus: string | null;
  initialLastTrackedAt: string | null;
  officialTrackingUrl: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ShipmentLiveTracking({
  orderId,
  provider,
  shipmentNumber,
  initialStatus,
  initialLastTrackedAt,
  officialTrackingUrl,
}: Props) {
  const router = useRouter();
  const deliveryRefreshDone = useRef(false);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/tracking?orderId=${orderId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Статусът не може да бъде проверен.");
      setTracking(data.tracking);
      if (data.tracking?.delivered && !deliveryRefreshDone.current) {
        deliveryRefreshDone.current = true;
        router.refresh();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Статусът не може да бъде проверен.");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    const initialCheck = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const checkedAt = tracking?.checkedAt || initialLastTrackedAt;
  const currentStatus = tracking?.status || initialStatus || "Товарителницата е създадена";

  return (
    <section className={styles.liveTracking} aria-live="polite">
      <div className={styles.liveTrackingHeader}>
        <div>
          <span><i aria-hidden="true" /> НА ЖИВО ОТ {provider === "ECONT" ? "ЕКОНТ" : "СПИДИ"}</span>
          <strong>{loading && !tracking ? "Проверяваме пратката…" : currentStatus}</strong>
          {checkedAt && <small>Проверено: {formatDate(checkedAt)}</small>}
        </div>
        <button type="button" onClick={refresh} disabled={loading}>{loading ? "Проверка…" : "Обнови"}</button>
      </div>

      {error && (
        <div className={styles.trackingError}>
          <span>{error}</span>
          <a href={officialTrackingUrl} target="_blank" rel="noreferrer">Провери при куриера ↗</a>
        </div>
      )}

      {tracking && tracking.events.length > 0 && (
        <ol className={styles.courierEvents} aria-label={`Куриерско движение на товарителница ${shipmentNumber}`}>
          {tracking.events.slice(0, 6).map((event, index) => (
            <li key={`${event.occurredAt}-${event.code || index}`}>
              <span aria-hidden="true" />
              <div>
                <strong>{event.description}</strong>
                <small>{[event.location, formatDate(event.occurredAt)].filter(Boolean).join(" · ")}</small>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!error && (
        <a className={styles.officialTrackingLink} href={officialTrackingUrl} target="_blank" rel="noreferrer">
          Резервна проверка в сайта на куриера ↗
        </a>
      )}
    </section>
  );
}
