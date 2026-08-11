import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createEpayPayment, paymentPageHtml } from "@/lib/payments/epay";
import { releaseExpiredReservations } from "@/lib/inventory";
import { getPublicSiteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Необходимо е да влезете в профила си.", { status: 401 });
  const orderId = Number(new URL(request.url).searchParams.get("order"));
  if (!Number.isInteger(orderId) || orderId <= 0) return new Response("Невалидна поръчка.", { status: 400 });
  let order = await prisma.order.findFirst({ where: { id: orderId, userId: session.userId } });
  if (!order || order.paymentMethod !== "CARD") return new Response("Поръчката не е намерена.", { status: 404 });
  if (await releaseExpiredReservations(prisma, { orderId })) {
    order = await prisma.order.findFirst({ where: { id: orderId, userId: session.userId } });
    if (!order || order.paymentMethod !== "CARD") return new Response("Поръчката не е намерена.", { status: 404 });
  }
  if (["PAID", "PAID_REVIEW_REQUIRED"].includes(order.paymentStatus)) {
    return Response.redirect(`${getPublicSiteUrl(request.url)}/order-success?order=${order.id}`);
  }
  if (["DENIED", "EXPIRED", "CANCELLED", "RESERVATION_EXPIRED"].includes(order.paymentStatus)) {
    return Response.redirect(`${getPublicSiteUrl(request.url)}/order-success?order=${order.id}`);
  }
  if (order.paymentStatus !== "AWAITING_PAYMENT" && order.paymentStatus !== "PENDING") {
    return new Response("Поръчката не е в състояние за онлайн плащане.", { status: 409 });
  }
  try {
    const appUrl = getPublicSiteUrl(request.url);
    return new Response(paymentPageHtml(createEpayPayment(order), order.id, appUrl), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Плащането не може да бъде стартирано.", { status: 503 });
  }
}
