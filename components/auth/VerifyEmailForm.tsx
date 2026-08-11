"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./AuthForm.module.css";
import TermsAcceptanceModal from "@/components/legal/TermsAcceptanceModal";

export default function VerifyEmailForm() {
  const router = useRouter();
  const search = useSearchParams();
  const email = search.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [termsToken, setTermsToken] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Кодът не беше потвърден.");
      if (data.needsTerms && data.termsToken) {
        setMessage("Имейлът е потвърден успешно.");
        setTermsToken(data.termsToken);
        return;
      }
      setMessage("Имейлът е потвърден. Вече можеш да влезеш.");
      setTimeout(() => router.push(`/login?verified=1`), 900);
    } catch { setError("Няма връзка със сървъра."); }
    finally { setLoading(false); }
  }

  async function resend() {
    setError(""); setMessage(""); setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Новият код не беше изпратен.");
      setMessage(data.testRecipient ? `Новият тестов код е изпратен към ${data.testRecipient}.` : "Изпратихме нов код.");
    } catch { setError("Няма връзка със сървъра."); }
    finally { setResending(false); }
  }

  if (!email) return <main className={styles.page}><section className={styles.card}><h1 className={styles.title}>Липсва имейл</h1><p className={styles.subtitle}>Започни регистрацията отначало.</p><Link href="/register" className={styles.button}>Към регистрацията</Link></section></main>;

  return <><main className={styles.page}><section className={styles.card}>
    <span className={styles.eyebrow}>ЗАЩИТА НА ПРОФИЛА</span>
    <h1 className={styles.title}>Потвърди имейла</h1>
    <p className={styles.subtitle}>Изпратихме 6-цифрен код за <strong>{email}</strong>. Кодът е валиден 15 минути.</p>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}><label>Код за потвърждение</label><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} required style={{fontSize:"1.6rem",letterSpacing:".45rem",textAlign:"center"}} /></div>
      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.success}>{message}</div>}
      <button className={styles.button} disabled={loading || code.length !== 6}>{loading ? "Проверка..." : "Потвърди профила"}</button>
    </form>
    <button type="button" className={styles.secondaryButton} onClick={resend} disabled={resending}>{resending ? "Изпращане..." : "Изпрати нов код"}</button>
    <p className={styles.switch}><Link href="/login">Назад към вход</Link></p>
  </section></main>{termsToken && <TermsAcceptanceModal token={termsToken} onAccepted={() => { router.push(`/account`); router.refresh(); }} />}</>;
}
