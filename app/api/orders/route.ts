import { NextResponse } from "next/server";
import { createPendingOrderFromCart, type CheckoutInput } from "@/lib/orders";
import { getSession } from "@/lib/session";
import { sendNewOrderEmails } from "@/lib/email";
import { isEpayConfigured } from "@/lib/payments/epay";
import { isCourierProvider, prepareShipping, type CheckoutShippingInput } from "@/lib/shipping";
import { renewCheckoutReservations } from "@/lib/cart";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";
import { publicCheckoutError } from "@/lib/checkout-error";
import { hasOnlyDigits, isValidPhoneCharacters } from "@/lib/numeric-fields";
import { getCartPromoPricing } from "@/lib/promo-codes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  if (!(await checkRateLimit(`checkout:${session.userId}`, { limit: 10, windowMs: 10 * 60 * 1000 })).allowed) {
    return NextResponse.json({ error: "Твърде много опити. Изчакай няколко минути." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as Partial<CheckoutInput>;
    const required = [body.customerName, body.customerPhone];
    if (required.some((value) => !value?.trim())) {
      return NextResponse.json({ error: "Попълни всички задължителни полета." }, { status: 400 });
    }
    if (!isValidPhoneCharacters(body.customerPhone) || !hasOnlyDigits(body.postalCode)) {
      return NextResponse.json({ error: "Телефонът или пощенският код съдържа непозволени знаци." }, { status: 400 });
    }
    if (!isCourierProvider(body.courierProvider)) {
      return NextResponse.json({ error: "Избери Еконт или Спиди." }, { status: 400 });
    }
    if (!(["ADDRESS", "OFFICE"] as const).includes(body.deliveryMethod as "ADDRESS" | "OFFICE")) {
      return NextResponse.json({ error: "Избери метод на доставка." }, { status: 400 });
    }
    if (body.deliveryMethod === "ADDRESS" && [body.address, body.city, body.postalCode].some((value) => !value?.trim())) {
      return NextResponse.json({ error: "Попълни адрес, град и пощенски код." }, { status: 400 });
    }
    if (body.deliveryMethod === "OFFICE" && !body.officeId?.trim()) {
      return NextResponse.json({ error: "Потърси и избери офис на куриера." }, { status: 400 });
    }
    if (!(["CASH_ON_DELIVERY", "CARD"] as const).includes(body.paymentMethod as "CASH_ON_DELIVERY" | "CARD")) {
      return NextResponse.json({ error: "Избери метод на плащане." }, { status: 400 });
    }
    if (body.paymentMethod === "CARD" && !isEpayConfigured()) {
      return NextResponse.json({ error: "Плащането с карта още не е активирано." }, { status: 503 });
    }
    if (body.shipmentDamageInstructionsAccepted !== true) {
      return NextResponse.json({ error: "Преди поръчката потвърди, че си прочел инструкциите за нарушена пратка." }, { status: 400 });
    }
    const reservation = await renewCheckoutReservations(session.userId);
    if (reservation.removedItems.length) {
      return NextResponse.json({
        code: "CART_ITEMS_REMOVED",
        error: "Резервацията беше подновена, но някои артикули вече не са налични.",
        ...reservation,
      }, { status: 409 });
    }
    if (!reservation.cart.items.length) return NextResponse.json({ error: "Количката е празна." }, { status: 400 });
    const promoPricing = await getCartPromoPricing(session.userId, body.promoCode);
    const shipping = await prepareShipping(
      { ...(body as CheckoutInput), customerEmail: session.email } as CheckoutShippingInput,
      promoPricing.discountedSubtotal,
    );
    const order = await createPendingOrderFromCart(session.userId, body as CheckoutInput, shipping);
    await sendNewOrderEmails(order);
    return NextResponse.json({
      orderId: order.id,
      paymentUrl: order.paymentMethod === "CARD" ? `/api/payments/epay/start?order=${order.id}` : null,
    }, { status: 201 });
  } catch (error) {
    console.error("Checkout order creation failed", error);
    return NextResponse.json({ error: publicCheckoutError(error) }, { status: 400 });
  }
}
