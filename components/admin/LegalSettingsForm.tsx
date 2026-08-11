"use client";
import { FormEvent, useState } from "react";
import styles from "@/app/admin/legal-settings/legal-settings.module.css";
import type { PublicLegalSettings } from "@/lib/legal-settings";

type Data = PublicLegalSettings;

export default function LegalSettingsForm({ initial }: { initial: Data }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fields: ReadonlyArray<[keyof Data, string]> = [
    ["companyName", "Наименование на фирмата"],
    ["companyId", "ЕИК / Булстат"],
    ["representativeName", "Представляващо лице"],
    ["registeredAddress", "Адрес на регистрация"],
    ["correspondenceAddress", "Адрес за кореспонденция"],
    ["returnsAddress", "Адрес за връщане на стоки"],
    ["contactEmail", "Основен имейл"],
    ["complaintsEmail", "Имейл за рекламации"],
    ["contactPhone", "Телефон"],
    ["websiteUrl", "Адрес на сайта"],
  ];

  const vatRegistered = form.isVatRegistered === true;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/legal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Записът не беше успешен.");
      setMessage("Фирмените и ДДС настройките са записани успешно.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Възникна грешка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.vatPanel}>
        <div>
          <strong>Регистрация по ЗДДС</strong>
          <p>Изберете изрично режима на фирмата. Наличието на текст в полето за ДДС номер вече не определя режима автоматично.</p>
        </div>
        <div className={styles.vatChoice}>
          <label><input type="radio" name="vatMode" checked={!vatRegistered} onChange={() => setForm({ ...form, isVatRegistered: false, vatNumber: "" })} /> Не</label>
          <label><input type="radio" name="vatMode" checked={vatRegistered} onChange={() => setForm({ ...form, isVatRegistered: true })} /> Да</label>
        </div>
        {vatRegistered && (
          <div className={styles.vatFields}>
            <label>ДДС номер<input value={String(form.vatNumber || "")} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="напр. BG123456789" required /></label>
            <label>Стандартна ДДС ставка (%)<input inputMode="decimal" value={String(form.defaultVatRate || "20.00")} onChange={(e) => setForm({ ...form, defaultVatRate: e.target.value })} placeholder="20.00" /></label>
          </div>
        )}
        <small>Важно: всяка нова поръчка запазва собствен snapshot на ДДС режима и ставката. По-късна промяна тук не преизчислява старите продажби.</small>
      </section>

      <div className={styles.grid}>
        {fields.map(([key, label]) => (
          <label key={key}>{label}<input value={String(form[key] || "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} /></label>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="submit" disabled={busy}>{busy ? "Запазване..." : "Запази фирмените данни"}</button>
        <a href="/terms" target="_blank" rel="noreferrer">Преглед на Общите условия ↗</a>
      </div>
      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
