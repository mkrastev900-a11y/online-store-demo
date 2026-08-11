import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCartPromoPricing, normalizePromoCode } from "@/lib/promo-codes";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  if (!(await checkRateLimit(`promo-validate:${session.userId}`, { limit: 30, windowMs: 60 * 1000 })).allowed) {
    return NextResponse.json({ error: "Твърде много опити. Изчакай малко и опитай отново." }, { status: 429 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const code = normalizePromoCode(body?.code);
    if (!code) return NextResponse.json({ error: "Въведи промокод." }, { status: 400 });
    const pricing = await getCartPromoPricing(session.userId, code);
    if (!pricing.promo) return NextResponse.json({ error: "Промокодът е невалиден или неактивен." }, { status: 400 });
    return NextResponse.json({
      promo: pricing.promo,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      discountedSubtotal: pricing.discountedSubtotal,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Промокодът не можа да бъде проверен." }, { status: 400 });
  }
}
