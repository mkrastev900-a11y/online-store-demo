import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/request-security";
import { getSession } from "@/lib/session";
import { isCourierProvider, trackCourierShipment } from "@/lib/shipping";
import { updateOrderStatusWithResult } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });

  const orderId = Number(new URL(request.url).searchParams.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Невалиден номер на поръчка." }, { status: 400 });
  }
  if (!(await checkRateLimit(`order-tracking:${session.userId}:${orderId}`, { limit: 30, windowMs: 10 * 60 * 1000 })).allowed) {
    return NextResponse.json({ error: "Статусът беше проверен съвсем скоро. Опитай след малко." }, { status: 429 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.userId },
    select: { id: true, status: true, courierProvider: true, shipmentNumber: true },
  });
  if (!order) return NextResponse.json({ error: "Поръчката не беше намерена." }, { status: 404 });
  if (!order.shipmentNumber || !isCourierProvider(order.courierProvider)) {
    return NextResponse.json({ error: "За поръчката още няма товарителница." }, { status: 404 });
  }

  try {
    const tracking = await trackCourierShipment(order.courierProvider, order.shipmentNumber);
    await prisma.order.update({
      where: { id: order.id },
      data: { shipmentStatus: tracking.status.slice(0, 500), shipmentLastTrackedAt: new Date(tracking.checkedAt) },
    });

    let orderStatus = order.status;
    if (tracking.delivered && order.status === "SHIPPED") {
      const delivered = await updateOrderStatusWithResult(order.id, OrderStatus.DELIVERED);
      orderStatus = delivered.order.status;
      if (delivered.changed) {
        await sendOrderStatusEmail(delivered.order).catch((emailError) => {
          console.error(`Delivered email failed for order ${order.id}`, emailError);
        });
      }
    }

    return NextResponse.json({ tracking, orderStatus }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(`Courier tracking failed for order ${order.id}`, error);
    return NextResponse.json({ error: "Куриерът временно не върна актуален статус. Опитай отново след малко." }, { status: 503 });
  }
}
