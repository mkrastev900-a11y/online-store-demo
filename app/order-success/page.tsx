/* eslint-disable @next/next/no-html-link-for-pages -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PaymentResultClient from "@/components/order-success/PaymentResultClient";
import styles from "./success.module.css";

export const dynamic = "force-dynamic";

export default async function OrderSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const params = await searchParams;
  const session = await getSession();
  const orderId = Number(params.order);
  const order = session && Number.isInteger(orderId) ? await prisma.order.findFirst({
    where: { id: orderId, userId: session.userId },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentExpiresAt: true,
      paidAt: true,
      total: true,
    },
  }) : null;

  if (!session) {
    return <main className={styles.main}><div className={styles.card}><span className={styles.icon}>!</span><h1>Влез в профила си</h1><p>За да видиш състоянието на поръчката, трябва да си влязъл в профила, от който е направена.</p><div className={styles.actions}><a href={`/login?next=${encodeURIComponent(`/order-success?order=${Number.isInteger(orderId) ? orderId : ""}`)}`}>Вход</a></div></div></main>;
  }

  if (!order) {
    return <main className={styles.main}><div className={`${styles.card} ${styles.tone_error}`}><span className={styles.icon}>×</span><h1>Поръчката не е намерена</h1><p>Не можем да покажем тази поръчка в текущия профил.</p><div className={styles.actions}><a href="/account#orders">Моите поръчки</a><a href="/" className={styles.secondary}>Начало</a></div></div></main>;
  }

  return <main className={styles.main}><PaymentResultClient initial={{
    id: order.id,
    orderStatus: order.status,
    paymentMethod: order.paymentMethod === "CARD" ? "CARD" : "CASH_ON_DELIVERY",
    paymentStatus: order.paymentStatus,
    paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    total: Number(order.total),
  }} /></main>;
}
