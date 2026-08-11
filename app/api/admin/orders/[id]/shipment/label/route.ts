import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { getSpeedyLabelPdf } from "@/lib/shipping/speedy";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAnyAdminPermissionApi(["ORDERS:SHIP"]))) return NextResponse.json({ error: "Нямаш право да отваряш товарителници." }, { status: 403 });
  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: "Невалидна поръчка." }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { courierProvider: true, shipmentNumber: true, shipmentLabelUrl: true } });
  if (!order?.shipmentNumber) return NextResponse.json({ error: "Поръчката няма товарителница." }, { status: 404 });
  if (order.courierProvider !== "SPEEDY") {
    if (order.shipmentLabelUrl?.startsWith("https://")) return Response.redirect(order.shipmentLabelUrl);
    return NextResponse.json({ error: "Няма наличен етикет." }, { status: 404 });
  }
  try {
    const pdf = await getSpeedyLabelPdf(order.shipmentNumber);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="speedy-${order.shipmentNumber}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Етикетът не можа да бъде зареден." }, { status: 503 });
  }
}
