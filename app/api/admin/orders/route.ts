import { NextResponse } from "next/server";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { listAdminOrders } from "@/lib/orders";

export async function GET() {
  const admin = await requireAdminPermissionApi("ORDERS:VIEW");

  if (!admin) {
    return NextResponse.json(
      { error: "Нямаш администраторски достъп." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    orders: await listAdminOrders(),
  });
}
