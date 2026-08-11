import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { releaseExpiredReservations } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });

  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Невалидна поръчка." }, { status: 400 });
  }

  let order = await prisma.order.findFirst({
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
  });

  if (!order) return NextResponse.json({ error: "Поръчката не е намерена." }, { status: 404 });
  if (await releaseExpiredReservations(prisma, { orderId })) {
    order = await prisma.order.findFirst({
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
    });
    if (!order) return NextResponse.json({ error: "Поръчката не е намерена." }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    total: Number(order.total),
  }, { headers: { "Cache-Control": "no-store" } });
}
