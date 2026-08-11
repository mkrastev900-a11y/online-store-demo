/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { isSameOriginRequest } from "@/lib/request-security";
import { normalizePromoCode, validatePromoPercent } from "@/lib/promo-codes";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  if (!(await requireAdminPermissionApi("PRODUCTS:EDIT"))) return NextResponse.json({ error: "Нямаш право да редактираш промокодове." }, { status: 403 });
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Невалиден промокод.");
    const body = await request.json();
    const code = normalizePromoCode(body.code);
    if (!code) throw new Error("Въведи име на промокода.");
    const regularDiscountPercent = validatePromoPercent(body.regularDiscountPercent, "Отстъпката за стоки без намаление");
    const saleDiscountPercent = validatePromoPercent(body.saleDiscountPercent, "Отстъпката за вече намалени стоки");
    const promo = await prisma.promoCode.update({ where: { id }, data: { code, regularDiscountPercent, saleDiscountPercent, isActive: body.isActive !== false } });
    return NextResponse.json({ promo: { ...promo, regularDiscountPercent: Number(promo.regularDiscountPercent), saleDiscountPercent: Number(promo.saleDiscountPercent) } });
  } catch (error: any) {
    const message = error?.code === "P2002" ? "Този промокод вече съществува." : error instanceof Error ? error.message : "Промокодът не беше запазен.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  if (!(await requireAdminPermissionApi("PRODUCTS:DELETE"))) return NextResponse.json({ error: "Нямаш право да изтриваш промокодове." }, { status: 403 });
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Невалиден промокод.");
    await prisma.promoCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Промокодът не беше изтрит." }, { status: 400 });
  }
}
