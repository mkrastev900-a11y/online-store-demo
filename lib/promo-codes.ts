import { prisma } from "@/lib/prisma";

export type PromoPricingItem = {
  quantity: number;
  product: {
    price: unknown;
    compareAtPrice?: unknown | null;
  };
};

export type AppliedPromo = {
  id: number;
  code: string;
  regularDiscountPercent: number;
  saleDiscountPercent: number;
};

export function normalizePromoCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function isSaleProduct(price: unknown, compareAtPrice: unknown | null | undefined) {
  const current = Number(price);
  const previous = Number(compareAtPrice);
  return Number.isFinite(current) && Number.isFinite(previous) && previous > current;
}

export function calculatePromoPricing(items: PromoPricingItem[], promo: AppliedPromo | null) {
  let subtotal = 0;
  let discount = 0;

  for (const item of items) {
    const unitPrice = Number(item.product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    const lineSubtotal = unitPrice * item.quantity;
    subtotal += lineSubtotal;
    if (!promo) continue;

    const percent = isSaleProduct(item.product.price, item.product.compareAtPrice)
      ? promo.saleDiscountPercent
      : promo.regularDiscountPercent;
    const lineDiscount = Math.round((lineSubtotal * percent / 100 + Number.EPSILON) * 100) / 100;
    discount += lineDiscount;
  }

  subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  discount = Math.min(subtotal, Math.round((discount + Number.EPSILON) * 100) / 100);
  const discountedSubtotal = Math.max(0, Math.round((subtotal - discount + Number.EPSILON) * 100) / 100);
  return { subtotal, discount, discountedSubtotal };
}

export async function findActivePromoCode(rawCode: unknown): Promise<AppliedPromo | null> {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) return null;
  return {
    id: promo.id,
    code: promo.code,
    regularDiscountPercent: Number(promo.regularDiscountPercent),
    saleDiscountPercent: Number(promo.saleDiscountPercent),
  };
}

export async function getCartPromoPricing(userId: number, rawCode: unknown) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: { select: { price: true, compareAtPrice: true, isActive: true } },
        },
      },
    },
  });
  if (!cart?.items.length) throw new Error("Количката е празна.");

  const code = normalizePromoCode(rawCode);
  const promo = code ? await findActivePromoCode(code) : null;
  if (code && !promo) throw new Error("Промокодът е невалиден или неактивен.");
  const pricing = calculatePromoPricing(cart.items, promo);
  return { cart, promo, ...pricing };
}

export function validatePromoPercent(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error(`${label} трябва да е между 0 и 100%.`);
  }
  return Math.round(number * 100) / 100;
}
