/* eslint-disable @next/next/no-html-link-for-pages -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { FormEvent, useState } from "react";
import styles from "./ProfileSecuritySettings.module.css";

export default function ProfileSecuritySettings({ authProvider, termsAcceptedAt, termsVersion }: { authProvider: string; termsAcceptedAt: string | null; termsVersion: string | null }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const usesGoogle = authProvider !== "credentials";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Паролата не можа да бъде сменена.");
        return;
      }
      setMessage(data.message || "Паролата е сменена успешно.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setError("Възникна проблем при смяната на паролата.");
    } finally {
      setBusy(false);
    }
  }

  function openCookieSettings() {
    window.dispatchEvent(new Event("zlatevi-open-cookie-settings"));
  }

  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <span>НАСТРОЙКИ НА ПРОФИЛА</span>
          <h2 tabIndex={-1}>Сигурност и поверителност</h2>
        </div>
        <p>Имейлът е заключен и не може да бъде сменян от профила.</p>
      </div>

      <div className={styles.columns}>
        <div className={styles.panel}>
          <h3>Смяна на паролата</h3>
          {usesGoogle ? (
            <p className={styles.note}>Този профил използва вход с Google. Паролата се управлява през Google.</p>
          ) : (
            <form onSubmit={submit} className={styles.form}>
              <label>Текуща парола<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label>
              <label>Нова парола<input type="password" autoComplete="new-password" minLength={8} required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
              <label>Потвърди новата парола<input type="password" autoComplete="new-password" minLength={8} required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
              <button type="submit" disabled={busy}>{busy ? "Запазване..." : "Смени паролата"}</button>
              {message ? <span className={styles.success}>{message}</span> : null}
              {error ? <span className={styles.error}>{error}</span> : null}
            </form>
          )}
        </div>

        <div className={styles.panel}>
          <h3>Общи условия</h3>
          <p className={styles.note}>{termsAcceptedAt ? `Приети на ${new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short" }).format(new Date(termsAcceptedAt))}.` : "Все още няма записано приемане на Общите условия."}</p>
          <p className={styles.note}>Приета версия: <strong>{termsVersion || "Няма записана версия"}</strong></p>
          <a className={styles.policyLink} href="/terms" target="_blank" rel="noreferrer">Прегледай Общите условия</a>
        </div>

        <div className={styles.panel}>
          <h3>Бисквитки и поверителност</h3>
          <p className={styles.note}>Промени разрешенията за функционални, аналитични и маркетинг бисквитки по всяко време.</p>
          <button type="button" className={styles.cookieButton} onClick={openCookieSettings}>Настройки за бисквитки</button>
          <a className={styles.policyLink} href="/cookie-policy">Прегледай политиката за бисквитки</a>
        </div>
      </div>
    </section>
  );
}
