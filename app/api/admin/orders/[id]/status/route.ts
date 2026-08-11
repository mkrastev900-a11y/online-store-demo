import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { updateOrderStatusWithResult } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email";

import { isSameOriginRequest } from "@/lib/request-security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const status = body.status as OrderStatus;
  const permissions = {
    CONFIRMED: ["ORDERS:CONFIRM"],
    SHIPPED: ["ORDERS:SHIP"],
    DELIVERED: ["ORDERS:DELIVER"],
    CANCELLED: ["ORDERS:CANCEL"],
  } as const;
  const permission = permissions[status as keyof typeof permissions];
  if (!permission) return NextResponse.json({ error: "Невалиден статус." }, { status: 400 });
  if (!(await requireAnyAdminPermissionApi(permission))) return NextResponse.json({ error: "Нямаш право за тази промяна на поръчката." }, { status: 403 });
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || !Object.values(OrderStatus).includes(status)) return NextResponse.json({ error: "Невалидни данни." }, { status: 400 });
  try {
    const result = await updateOrderStatusWithResult(orderId, status);
    if (result.changed) await sendOrderStatusEmail(result.order);
    return NextResponse.json({ order: result.order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Статусът не беше променен." }, { status: 409 });
  }
}
