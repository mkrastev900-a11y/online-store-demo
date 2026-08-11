import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isCourierProvider, prepareShipping, type CheckoutShippingInput } from "@/lib/shipping";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";
import { getCartPromoPricing } from "@/lib/promo-codes";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  if (!(await checkRateLimit(`shipping-quote:${session.userId}`, { limit: 30, windowMs: 60 * 1000 })).allowed) {
    return NextResponse.json({ error: "Твърде много заявки за цена. Опитай отново след минута." }, { status: 429 });
  }
  try {
    const body = await request.json() as Partial<CheckoutShippingInput> & { promoCode?: string };
    if (!isCourierProvider(body.courierProvider)) return NextResponse.json({ error: "Избери куриер." }, { status: 400 });
    const pricing = await getCartPromoPricing(session.userId, body.promoCode);
    const shipping = await prepareShipping({ ...body, customerEmail: session.email } as CheckoutShippingInput, pricing.discountedSubtotal);
    return NextResponse.json({ shipping, total: pricing.discountedSubtotal + shipping.customerCost, promoDiscount: pricing.discount, discountedSubtotal: pricing.discountedSubtotal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Доставката не можа да бъде изчислена." }, { status: 400 });
  }
}
