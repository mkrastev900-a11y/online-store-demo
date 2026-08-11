import { prisma } from "@/lib/prisma";
import { parseEpayNotifications, verifyEpayNotification } from "@/lib/payments/epay";
import { applyFailedCardNotification, applyPaidCardNotificationWithResult } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email";

export async function POST(request: Request) {
  const form = await request.formData();
  const encoded = String(form.get("ENCODED") || "");
  const checksum = String(form.get("CHECKSUM") || "");
  if (!verifyEpayNotification(encoded, checksum)) return new Response("ERR=INVALID_CHECKSUM", { status: 400 });
  const notifications = parseEpayNotifications(encoded);
  if (!notifications.length) return new Response("ERR=INVALID_DATA", { status: 400 });

  const acknowledgements: string[] = [];
  for (const notification of notifications) {
    const order = await prisma.order.findUnique({ where: { id: notification.invoice } });
    if (!order || order.paymentMethod !== "CARD") {
      acknowledgements.push(`INVOICE=${notification.invoice}:STATUS=NO`);
      continue;
    }
    if (notification.status === "PAID") {
      const reference = [notification.stan, notification.bcode].filter(Boolean).join("/") || null;
      const paidResult = await applyPaidCardNotificationWithResult(order.id, reference).catch((error) => {
        console.error(`Paid ePay order ${order.id} requires manual review:`, error);
        return null;
      });
      if (paidResult?.shouldSendConfirmationEmail && paidResult.order.paymentStatus === "PAID" && paidResult.order.status === "CONFIRMED") {
        await sendOrderStatusEmail(paidResult.order).catch((error) => {
          console.error(`Paid ePay confirmation email failed for order ${order.id}:`, error);
        });
      }
    } else {
      await applyFailedCardNotification(order.id, notification.status);
    }
    acknowledgements.push(`INVOICE=${notification.invoice}:STATUS=OK`);
  }
  return new Response(acknowledgements.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
