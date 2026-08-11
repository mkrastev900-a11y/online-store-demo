"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContactEmailLink from "@/components/ContactEmailLink";
import styles from "@/app/order-success/success.module.css";
import { trackMarketingEvent } from "@/components/MarketingPixelManager";

type PaymentStatus = "PENDING" | "AWAITING_PAYMENT" | "PAYMENT_ON_DELIVERY" | "PAID" | "PAID_REVIEW_REQUIRED" | "DENIED" | "EXPIRED" | "CANCELLED" | "RESERVATION_EXPIRED";
type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

type PaymentState = {
  id: number;
  orderStatus: OrderStatus;
  paymentMethod: "CASH_ON_DELIVERY" | "CARD";
  paymentStatus: PaymentStatus;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  total: number;
};

const terminal = new Set<PaymentStatus>(["PAID", "PAID_REVIEW_REQUIRED", "DENIED", "EXPIRED", "CANCELLED", "RESERVATION_EXPIRED", "PAYMENT_ON_DELIVERY"]);

function viewFor(state: PaymentState) {
  if (state.paymentMethod === "CASH_ON_DELIVERY" || state.paymentStatus === "PAYMENT_ON_DELIVERY") {
    return {
      tone: "success",
      icon: "✓",
      eyebrow: "ПОРЪЧКАТА Е ПРИЕТА",
      title: "Поръчката е приета",
      text: "Ще получиш имейл с детайлите. Плащането е при получаване на пратката.",
    } as const;
  }
  if (state.paymentStatus === "PAID") {
    return {
      tone: "success",
      icon: "✓",
      eyebrow: "ПЛАЩАНЕТО Е ПОТВЪРДЕНО",
      title: "Поръчката е платена",
      text: "Плащането е потвърдено от ePay.bg и поръчката вече се обработва.",
    } as const;
  }
  if (state.paymentStatus === "PAID_REVIEW_REQUIRED") {
    return {
      tone: "warning",
      icon: "!",
      eyebrow: "ПЛАЩАНЕТО Е ПОЛУЧЕНО",
      title: "Проверяваме поръчката",
      text: "ePay.bg е потвърдил плащането, но поръчката изисква кратка ръчна проверка. Не плащай повторно.",
    } as const;
  }
  if (state.paymentStatus === "DENIED") {
    return {
      tone: "error",
      icon: "×",
      eyebrow: "ПЛАЩАНЕТО Е ОТКАЗАНО",
      title: "Плащането не е успешно",
      text: "ePay.bg е отказал плащането. Поръчката не е потвърдена и няма да бъде изпратена като платена.",
    } as const;
  }
  if (state.paymentStatus === "EXPIRED" || state.paymentStatus === "RESERVATION_EXPIRED") {
    return {
      tone: "error",
      icon: "⌛",
      eyebrow: "ПЛАЩАНЕТО Е ИЗТЕКЛО",
      title: "Срокът за плащане изтече",
      text: "Плащането не е завършено в определения срок. Ако още искаш продуктите, направи нова поръчка според текущата наличност.",
    } as const;
  }
  if (state.paymentStatus === "CANCELLED" || state.orderStatus === "CANCELLED") {
    return {
      tone: "error",
      icon: "×",
      eyebrow: "ПОРЪЧКАТА Е ОТКАЗАНА",
      title: "Поръчката е отказана",
      text: "Тази поръчка вече не е активна.",
    } as const;
  }
  return {
    tone: "pending",
    icon: "…",
    eyebrow: "ОЧАКВАМЕ EPAY.BG",
    title: "Проверяваме плащането",
    text: "Плащането се потвърждава автоматично. Страницата ще се обнови сама — не е необходимо да натискаш F5 и не плащай повторно.",
  } as const;
}

export default function PaymentResultClient({ initial }: { initial: PaymentState }) {
  const [state, setState] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [temporaryError, setTemporaryError] = useState("");
  const attempts = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch(`/api/orders/${state.id}/payment-status`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Статусът не можа да бъде проверен.");
      if (mounted.current) {
        setState(data as PaymentState);
        setTemporaryError("");
      }
    } catch (error) {
      if (mounted.current) setTemporaryError(error instanceof Error ? error.message : "Статусът не можа да бъде проверен.");
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, [checking, state.id]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (state.paymentMethod !== "CARD" || terminal.has(state.paymentStatus)) return;
    if (attempts.current >= 30) return;
    const timer = window.setTimeout(() => {
      attempts.current += 1;
      void refresh();
    }, attempts.current < 10 ? 2000 : 5000);
    return () => window.clearTimeout(timer);
  }, [refresh, state.paymentMethod, state.paymentStatus]);

  useEffect(() => {
    const completed = state.paymentMethod === "CASH_ON_DELIVERY" || state.paymentStatus === "PAYMENT_ON_DELIVERY" || state.paymentStatus === "PAID";
    if (!completed) return;
    const key = `zlatevi-purchase-tracked:${state.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      trackMarketingEvent({ event: "purchase", orderId: state.id, value: state.total, currency: "EUR" });
      window.sessionStorage.setItem(key, "1");
    } catch {
      trackMarketingEvent({ event: "purchase", orderId: state.id, value: state.total, currency: "EUR" });
    }
  }, [state.id, state.paymentMethod, state.paymentStatus, state.total]);

  const view = useMemo(() => viewFor(state), [state]);
  const canRetryCheckout = ["DENIED", "EXPIRED", "RESERVATION_EXPIRED", "CANCELLED"].includes(state.paymentStatus);

  return <div className={`${styles.card} ${styles[`tone_${view.tone}`]}`}>
    <span className={styles.icon}>{view.icon}</span>
    <small className={styles.eyebrow}>{view.eyebrow}</small>
    <h1>{view.title}</h1>
    <p>{view.text}</p>
    <p className={styles.contactHint}>
      За въпрос по поръчката: <ContactEmailLink purpose="orders" />
    </p>

    {state.paymentMethod === "CARD" && !terminal.has(state.paymentStatus) ? <div className={styles.liveStatus}>
      <span className={styles.pulse} aria-hidden="true" />
      <span>{checking ? "Проверяваме ePay.bg…" : "Автоматична проверка на плащането"}</span>
      <button type="button" onClick={() => void refresh()} disabled={checking}>{checking ? "Проверка…" : "Провери сега"}</button>
    </div> : null}

    {temporaryError ? <p className={styles.inlineWarning}>{temporaryError} Ще опитаме отново автоматично.</p> : null}

    <div className={styles.orderSummary}>
      <span>Сума</span>
      <strong>{new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(state.total)}</strong>
    </div>

    <div className={styles.actions}>
      <Link href="/account#orders">Виж поръчката</Link>
      {canRetryCheckout ? <Link href="/" className={styles.secondary}>Към продуктите</Link> : <Link href="/" className={styles.secondary}>Към началната страница</Link>}
      {canRetryCheckout ? <Link href="/contact" className={styles.textAction}>Нужна ми е помощ</Link> : null}
    </div>
  </div>;
}
