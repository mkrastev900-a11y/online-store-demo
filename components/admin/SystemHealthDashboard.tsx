"use client";

import { useState, type CSSProperties } from "react";
import type { SystemHealthSnapshot } from "@/lib/system-health";
import styles from "@/app/admin/system-health/health.module.css";
import AdminAlertReviewButton from "@/components/admin/AdminAlertReviewButton";

const statusLabels = { healthy: "РАБОТИ", warning: "ВНИМАНИЕ", error: "ПРОБЛЕМ" } as const;

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}д` : "", hours ? `${hours}ч` : "", `${minutes}м`].filter(Boolean).join(" ");
}

export default function SystemHealthDashboard({ initialSnapshot, configurationAlertKeys }: { initialSnapshot: SystemHealthSnapshot; configurationAlertKeys: string[] }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system-health", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Проверката не успя.");
      setSnapshot(data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Проверката не успя.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>СИСТЕМНО ЗДРАВЕ · v26</span>
          <h1>Състояние на системата</h1>
          <p>Live проверки на базата, услугите, сигурността и ресурсите на приложението.</p>
        </div>
        <div className={styles.scoreCard} data-status={snapshot.overall}>
          <div className={styles.scoreRing} style={{ "--score": `${snapshot.score * 3.6}deg` } as CSSProperties}>
            <strong>{snapshot.score}</strong><span>/100</span>
          </div>
          <div><small>ОБЩО СЪСТОЯНИЕ</small><b>{snapshot.overall === "healthy" ? "Отлично" : snapshot.overall === "warning" ? "Изисква внимание" : "Има проблем"}</b></div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <span>Последна проверка: {new Date(snapshot.checkedAt).toLocaleString("bg-BG")}</span>
        <button onClick={refresh} disabled={busy}>{busy ? "Проверявам…" : "↻ Обнови проверките"}</button>
      </div>
      {error && <p className={styles.errorMessage}>{error}</p>}

      <section className={styles.metrics}>
        <article><span>CPU</span><strong>{snapshot.runtime.cpuLoadPercent}%</strong><p>{snapshot.runtime.cpuCount} логически ядра</p></article>
        <article><span>RAM</span><strong>{snapshot.runtime.systemMemoryUsedPercent}%</strong><p>Процес: {snapshot.runtime.processMemoryMb} MB</p></article>
        <article><span>UPTIME</span><strong>{formatUptime(snapshot.runtime.uptimeSeconds)}</strong><p>Текущ Node процес</p></article>
      </section>

      <section className={styles.grid}>
        {snapshot.checks.map((check) => {
          const unread = configurationAlertKeys.includes(check.id);
          return <article key={check.id} data-status={check.status} className={unread ? styles.unreadCheck : ""}>
            <div className={styles.statusIcon}>{check.status === "healthy" ? "✓" : check.status === "warning" ? "!" : "×"}</div>
            <div className={styles.checkBody}>
              <div className={styles.checkTop}><span>{statusLabels[check.status]}</span>{unread ? <b className={styles.newPill}>Ново</b> : null}{typeof check.latencyMs === "number" && <small>{check.latencyMs} ms</small>}</div>
              <h2>{check.name}</h2>
              <strong>{check.summary}</strong>
              <p>{check.detail}</p>
              {unread ? <AdminAlertReviewButton href="/admin/system-health" itemKey={`warning:${check.id}`} eventVersion="missing" /> : null}
            </div>
          </article>;
        })}
      </section>

      <section className={styles.info}>
        <div><span>ПРИЛОЖЕНИЕ</span><strong>v{snapshot.runtime.appVersion}</strong></div>
        <div><span>NODE.JS</span><strong>{snapshot.runtime.nodeVersion}</strong></div>
        <div><span>NEXT.JS</span><strong>{snapshot.runtime.nextVersion}</strong></div>
        <div><span>PRISMA</span><strong>{snapshot.runtime.prismaVersion}</strong></div>
        <div><span>СРЕДА</span><strong>{snapshot.runtime.environment}</strong></div>
        <div><span>DEPLOYMENT</span><strong>{snapshot.runtime.deployment}</strong></div>
      </section>

      <aside className={styles.note}><b>Важно:</b> външните услуги могат временно да покажат „Внимание“ при бавна мрежа. Секретните ключове никога не се показват на тази страница.</aside>
    </>
  );
}
