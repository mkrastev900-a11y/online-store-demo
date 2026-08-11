/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { isSameOriginRequest } from "@/lib/request-security";
import { normalizePromoCode, validatePromoPercent } from "@/lib/promo-codes";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdminPermissionApi("PRODUCTS:VIEW"))) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  const promoCodes = await prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ promoCodes: promoCodes.map((item) => ({ ...item, regularDiscountPercent: Number(item.regularDiscountPercent), saleDiscountPercent: Number(item.saleDiscountPercent) })) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  if (!(await requireAdminPermissionApi("PRODUCTS:EDIT"))) return NextResponse.json({ error: "Нямаш право да създаваш промокодове." }, { status: 403 });
  try {
    const body = await request.json();
    const code = normalizePromoCode(body.code);
    if (!code) throw new Error("Въведи име на промокода.");
    if (code.length > 60) throw new Error("Промокодът е прекалено дълъг.");
    const regularDiscountPercent = validatePromoPercent(body.regularDiscountPercent, "Отстъпката за стоки без намаление");
    const saleDiscountPercent = validatePromoPercent(body.saleDiscountPercent, "Отстъпката за вече намалени стоки");
    const promo = await prisma.promoCode.create({ data: { code, regularDiscountPercent, saleDiscountPercent, isActive: body.isActive !== false } });
    return NextResponse.json({ promo: { ...promo, regularDiscountPercent: Number(promo.regularDiscountPercent), saleDiscountPercent: Number(promo.saleDiscountPercent) } }, { status: 201 });
  } catch (error: any) {
    const message = error?.code === "P2002" ? "Този промокод вече съществува." : error instanceof Error ? error.message : "Промокодът не беше създаден.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
