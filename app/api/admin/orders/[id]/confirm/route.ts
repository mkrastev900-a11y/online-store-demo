import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { confirmOrderAndDecreaseStockWithResult } from "@/lib/orders";
import { sendOrderStatusEmail } from "@/lib/email";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["ORDERS:CONFIRM"]);

  if (!admin) {
    return NextResponse.json(
      { error: "Нямаш администраторски достъп." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { error: "Невалидна поръчка." },
      { status: 400 },
    );
  }

  try {
    const result = await confirmOrderAndDecreaseStockWithResult(orderId);
    if (result.changed) await sendOrderStatusEmail(result.order);
    return NextResponse.json({ order: result.order });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Поръчката не беше потвърдена.",
      },
      { status: 409 },
    );
  }
}
