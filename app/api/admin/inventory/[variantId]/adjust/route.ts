import { NextResponse } from "next/server";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { adjustVariantStock } from "@/lib/inventory";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("INVENTORY:ADJUST");

  if (!admin) {
    return NextResponse.json(
      { error: "Нямаш администраторски достъп." },
      { status: 403 },
    );
  }

  try {
    const { variantId } = await context.params;
    const body = await request.json();

    const variant = await adjustVariantStock({
      variantId: Number(variantId),
      newStock: Number(body.newStock),
      note: String(body.note ?? "").trim() || undefined,
    });

    return NextResponse.json({ variant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Грешка." },
      { status: 400 },
    );
  }
}
