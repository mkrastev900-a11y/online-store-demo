"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleAuthButton from "./GoogleAuthButton";
import styles from "./AuthForm.module.css";
import { emitAuthUpdated } from "@/lib/auth-events";

const googleErrorMessages: Record<string, string> = {
  google_config: "Google входът не е настроен. Липсват реални GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET. Примерните стойности не могат да се използват.",
  google_state: "Google сесията изтече. Опитай отново.",
  google_unverified: "Google акаунтът няма потвърден имейл.",
  google_failed: "Google входът не беше завършен. Опитай отново.",
  inactive: "Профилът е деактивиран.",
};

function safeInternalPath(value: string | null, fallback = "/account") {
  if (!value?.startsWith("/") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = new URL("https://store.invalid");
    const resolved = new URL(value, base);
    return resolved.origin === base.origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export default function LoginForm() {
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
      const response = await fetch("/api/auth/login", {
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
        if (data.needsTerms && data.termsToken) {
          router.push(`/accept-terms?token=${encodeURIComponent(data.termsToken)}&next=${encodeURIComponent("/account")}`);
          return;
        }
        return setError(data.error ?? "Грешка.");
      }
      // Set-Cookie е source of truth. Потвърждаваме сесията от сървъра и
      // правим пълна навигация, за да се презареди Header с реалния профил/роля.
      if (data?.user) emitAuthUpdated({ user: data.user });
      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      const meData = await meResponse.json().catch(() => null);
      if (!meResponse.ok || !meData?.user) {
        return setError("Сесията не беше създадена. Опитай отново.");
      }
      const next = searchParams.get("next");
      const isAdmin = meData.user.role === "ADMIN" || meData.user.role === "SUPER_ADMIN";
      // Администраторът влиза като реален SUPER_ADMIN профил, но след login
      // винаги се връща на началната страница. Бутонът „Админ“ в Header
      // остава достъпен и води към /admin.
      const destination = isAdmin ? "/" : safeInternalPath(next, "/account");
      window.location.assign(destination);
    } catch {
      setError("Няма връзка със сървъра.");
    } finally {
      setLoading(false);
    }
  }

  const next = searchParams.get("next");
  const safeNext = safeInternalPath(next);
  const googleHref = `/api/auth/google?source=login${next ? `&next=${encodeURIComponent(safeNext)}` : ""}`;
  const googleError = searchParams.get("error");
  const verifiedMessage = searchParams.get("verified") === "1"
    ? "Имейлът е потвърден успешно. Вече можеш да влезеш в профила си."
    : "";
  const visibleError = error || (googleError ? googleErrorMessages[googleError] ?? "Входът с Google не беше завършен. Опитай отново." : "");

  return <main className={styles.page}><section className={styles.card}>
    <span className={styles.eyebrow} suppressHydrationWarning translate="no">ДОБРЕ ДОШЪЛ</span>
    <h1 className={styles.title}>Вход</h1>
    <p className={styles.subtitle}>Влез в профила си, за да продължиш.</p>
    <GoogleAuthButton href={googleHref} action="login" />
    <div className={styles.divider}><span>или</span></div>
    <form className={styles.form} method="post" action="/api/auth/login" onSubmit={submit}>
      <div className={styles.field}><label>Имейл или потребителско име</label><input name="email" type="text" autoComplete="username" required/></div>
      <div className={styles.field}><div className={styles.labelRow}><label>Парола</label><Link href="/forgot-password" className={styles.forgotLink}>Забравена парола?</Link></div><input name="password" type="password" required/></div>
      {verifiedMessage && <div className={styles.success}>{verifiedMessage}</div>}
      {visibleError && <div className={styles.error}>{visibleError}</div>}
      <button type="submit" className={styles.button} disabled={loading}>{loading ? "Влизане..." : "Влез"}</button>
    </form>
    <p className={styles.switch}>Нямаш профил? <Link href="/register">Регистрирай се</Link></p>
  </section></main>;
}
