"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleAuthButton from "./GoogleAuthButton";
import { phoneCharactersOnly } from "@/lib/numeric-fields";
import styles from "./AuthForm.module.css";

const googleErrorMessages: Record<string, string> = {
  google_config: "Google регистрацията не е настроена. Липсват реални GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET. Примерните стойности не могат да се използват.",
  google_state: "Google сесията изтече. Опитай отново.",
  google_unverified: "Google акаунтът няма потвърден имейл.",
  google_failed: "Google регистрацията не беше завършена. Опитай отново.",
  inactive: "Профилът е деактивиран.",
};

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.needsVerification && data.email) {
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
          return;
        }
        return setError(data.error ?? "Грешка.");
      }
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch {
      setError("Няма връзка със сървъра.");
    } finally {
      setLoading(false);
    }
  }

  const googleError = searchParams.get("error");
  const visibleError = error || (googleError ? googleErrorMessages[googleError] ?? "Google регистрацията не беше завършена. Опитай отново." : "");

  return <main className={styles.page}><section className={styles.card}>
    <span className={styles.eyebrow}>НОВ КЛИЕНТ</span>
    <h1 className={styles.title}>Регистрация</h1>
    <p className={styles.subtitle}>Създай профил за лична количка и бъдещи поръчки.</p>
    <GoogleAuthButton href="/api/auth/google?source=register" action="register" />
    <div className={styles.divider}><span>или</span></div>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}><label>Име и фамилия</label><input name="name" required minLength={2}/></div>
      <div className={styles.field}><label>Имейл</label><input name="email" type="email" required/></div>
      <div className={styles.field}><label>Телефон</label><input name="phone" type="tel" inputMode="tel" pattern="[+]?[0-9]+" onInput={(event) => { event.currentTarget.value = phoneCharactersOnly(event.currentTarget.value); }}/></div>
      <div className={styles.field}><label>Парола</label><input name="password" type="password" required minLength={8}/></div>
      <div className={styles.field}><label>Повтори паролата</label><input name="confirmPassword" type="password" required minLength={8}/></div>
      {visibleError && <div className={styles.error}>{visibleError}</div>}
      <button className={styles.button} disabled={loading}>{loading ? "Създаване..." : "Създай профил"}</button>
    </form>
    <p className={styles.switch}>Вече имаш профил? <Link href="/login">Влез</Link></p>
  </section></main>;
}
