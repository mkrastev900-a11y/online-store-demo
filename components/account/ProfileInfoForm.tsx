"use client";

import { FormEvent, useState } from "react";
import { digitsOnly, phoneCharactersOnly } from "@/lib/numeric-fields";
import styles from "./ProfileInfoForm.module.css";
import { emitAuthUpdated } from "@/lib/auth-events";

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
};

export default function ProfileInfoForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    phone: profile.phone || "",
    address: profile.address || "",
    addressLine2: profile.addressLine2 || "",
    city: profile.city || "",
    postalCode: profile.postalCode || "",
    country: profile.country || "Bulgaria",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Данните не можаха да бъдат запазени.");
        return;
      }
      emitAuthUpdated();
      setMessage("Профилните данни са запазени успешно.");
    } catch {
      setError("Възникна проблем при запазването.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <span>ПРОФИЛНА ИНФОРМАЦИЯ</span>
          <h2>Лични данни и адрес</h2>
        </div>
        <p>Тези данни ще се попълват автоматично при следваща поръчка.</p>
      </div>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.grid}>
          <label>
            Име и фамилия
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Имейл
            <input value={profile.email} disabled aria-describedby="locked-email-note" />
            <small id="locked-email-note">Имейлът е заключен и не може да бъде променян.</small>
          </label>
          <label>
            Телефон
            <input type="tel" inputMode="tel" pattern="[+]?[0-9]+" value={form.phone} onChange={(e) => setForm({ ...form, phone: phoneCharactersOnly(e.target.value) })} />
          </label>
          <label>
            Държава
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </label>
          <label className={styles.full}>
            Адрес
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Улица, номер" />
          </label>
          <label className={styles.full}>
            Допълнение към адреса
            <input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} placeholder="Вход, етаж, апартамент, офис — по желание" />
          </label>
          <label>
            Град
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label>
            Пощенски код
            <input inputMode="numeric" pattern="[0-9]*" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: digitsOnly(e.target.value) })} />
          </label>
        </div>

        <div className={styles.actions}>
          <button type="submit" disabled={busy}>{busy ? "Запазване..." : "Запази данните"}</button>
          {message && <span className={styles.success}>{message}</span>}
          {error && <span className={styles.error}>{error}</span>}
        </div>
      </form>
    </section>
  );
}
