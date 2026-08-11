import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { createCourierShipment, isCourierProvider, type ShipmentRequest, type ShippingOffice } from "@/lib/shipping";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";
import { sendOrderStatusEmail } from "@/lib/email";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["ORDERS:SHIP"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право да създаваш товарителници." }, { status: 403 });
  if (!(await checkRateLimit(`shipment-create:${admin.id}`, { limit: 10, windowMs: 60 * 1000 })).allowed) return NextResponse.json({ error: "Твърде много заявки. Изчакай една минута." }, { status: 429 });
  const orderId = Number((await context.params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: "Невалидна поръчка." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) return { ok: false as const, error: "Поръчката не е намерена.", status: 404 };
      if (order.status !== "CONFIRMED") return { ok: false as const, error: "Първо потвърди поръчката, след това създай товарителницата.", status: 409 };
      if (order.shipmentNumber) return { ok: false as const, error: `Вече има товарителница ${order.shipmentNumber}.`, status: 409 };
      if (!isCourierProvider(order.courierProvider)) return { ok: false as const, error: "Поръчката няма валиден куриер.", status: 400 };
      if (order.deliveryMethod !== "ADDRESS" && order.deliveryMethod !== "OFFICE") return { ok: false as const, error: "Поръчката няма валиден начин на доставка.", status: 400 };

      const office: ShippingOffice | undefined = order.deliveryMethod === "OFFICE" && order.courierOfficeId ? {
        provider: order.courierProvider,
        id: order.courierOfficeId,
        code: order.courierOfficeCode || undefined,
        name: order.courierOfficeName || "Офис",
        address: order.courierOfficeAddress || order.address,
        city: order.city,
        postalCode: order.postalCode,
        type: "OFFICE",
      } : undefined;
      const shipmentRequest: ShipmentRequest = {
        orderId: order.id,
        courierProvider: order.courierProvider,
        deliveryMethod: order.deliveryMethod,
        office,
        serviceId: order.courierServiceId || undefined,
        paymentMethod: order.paymentMethod === "CARD" ? "CARD" : "CASH_ON_DELIVERY",
        amountToCollect: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : 0,
        weightKg: Math.max(Number(process.env.DEFAULT_SHIPMENT_WEIGHT_KG || 0.5), order.items.reduce((sum, item) => sum + item.quantity * 0.25, 0)),
        description: `Поръчка #${order.id}: ${order.items.map((item) => item.name).join(", ").slice(0, 180)}`,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone || "",
        address: order.address,
        addressLine2: order.addressLine2 || undefined,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country,
      };
      const shipment = await createCourierShipment(shipmentRequest);
      const shippedAt = new Date();
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          shipmentNumber: shipment.shipmentNumber,
          shipmentLabelUrl: shipment.labelUrl || (order.courierProvider === "SPEEDY" ? `/api/admin/orders/${order.id}/shipment/label` : null),
          shipmentStatus: shipment.status || "CREATED",
          shipmentCreatedAt: shippedAt,
          shipmentLastTrackedAt: shippedAt,
          status: "SHIPPED",
          shippedAt,
        },
        include: { items: true },
      });
      return { ok: true as const, shipment, updated };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 20_000,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await sendOrderStatusEmail(result.updated).catch((emailError) => {
      console.error(`Shipment email failed for order ${orderId}:`, emailError);
    });
    return NextResponse.json({ shipment: result.shipment, order: result.updated }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Товарителницата не можа да бъде създадена." }, { status: 503 });
  }
}
