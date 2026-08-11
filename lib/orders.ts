/* eslint-disable @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CARD_ORDER_RESERVATION_HOURS,
  COD_ORDER_RESERVATION_HOURS,
  releaseExpiredReservations,
} from "@/lib/inventory";
import type { CheckoutPaymentMethod, CourierProvider, DeliveryMethod, PreparedShipping } from "@/lib/shipping/types";
import { calculatePromoPricing, normalizePromoCode } from "@/lib/promo-codes";

export type CheckoutInput = {
  customerName: string;
  customerPhone: string;
  address: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
  courierProvider: CourierProvider;
  deliveryMethod: DeliveryMethod;
  officeId?: string;
  paymentMethod: CheckoutPaymentMethod;
  notes?: string;
  shipmentDamageInstructionsAccepted: boolean;
  promoCode?: string;
};

export async function createPendingOrderFromCart(userId: number, input: CheckoutInput, shipping: PreparedShipping) {
  return prisma.$transaction(async (tx) => {
    await releaseExpiredReservations(tx, { userId });
    // Serialize checkout against cart add/update/remove/renew operations for this user.
    const cartIdentity = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cartIdentity) throw new Error("Количката е празна.");
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        cart: { include: { items: { include: { product: { select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, imageUrl: true, isActive: true } }, variant: true } } } },
        reservations: { where: { expiresAt: { gt: new Date() } } },
      },
    });
    if (!user || !user.cart?.items.length) throw new Error("Количката е празна.");
    for (const item of user.cart.items) {
      if (!item.product.isActive || !item.variant.isActive || item.variant.productId !== item.productId) {
        throw new Error(`Количката съдържа некоректно свързан или неактивен вариант за ${item.product.name}. Премахни артикула и го добави отново.`);
      }
      const reservation = user.reservations.find((entry) => entry.variantId === item.variantId);
      if (!reservation || reservation.quantity < item.quantity) {
        throw new Error(`Резервацията за ${item.product.name}, размер ${item.variant.size}, е изтекла.`);
      }
    }
    const requestedPromoCode = normalizePromoCode(input.promoCode);
    const promoRecord = requestedPromoCode
      ? await tx.promoCode.findUnique({ where: { code: requestedPromoCode } })
      : null;
    if (requestedPromoCode && (!promoRecord || !promoRecord.isActive)) {
      throw new Error("Промокодът е невалиден или неактивен.");
    }
    const promo = promoRecord ? {
      id: promoRecord.id,
      code: promoRecord.code,
      regularDiscountPercent: Number(promoRecord.regularDiscountPercent),
      saleDiscountPercent: Number(promoRecord.saleDiscountPercent),
    } : null;
    const pricing = calculatePromoPricing(user.cart.items, promo);
    const subtotal = pricing.subtotal;
    const discountedSubtotal = pricing.discountedSubtotal;
    const shippingCost = discountedSubtotal >= Number(process.env.SHIPPING_FREE_THRESHOLD_EUR || 120) ? 0 : shipping.customerCost;
    const orderTotal = discountedSubtotal + shippingCost;
    const legalSettings = await tx.legalSettings.findUnique({ where: { id: 1 } }).catch(() => null);
    const vatRegisteredAtSale = Boolean(legalSettings?.isVatRegistered);
    const configuredVatRate = Number(legalSettings?.defaultVatRate ?? 20);
    const vatRateAtSale = vatRegisteredAtSale && Number.isFinite(configuredVatRate) ? configuredVatRate : 0;
    const taxBaseAtSale = vatRegisteredAtSale
      ? Math.round((orderTotal / (1 + vatRateAtSale / 100) + Number.EPSILON) * 100) / 100
      : Math.round((orderTotal + Number.EPSILON) * 100) / 100;
    const vatAmountAtSale = vatRegisteredAtSale
      ? Math.round((orderTotal - taxBaseAtSale + Number.EPSILON) * 100) / 100
      : 0;
    const deliveryAddress = shipping.office?.address || input.address.trim();
    const deliveryCity = shipping.office?.city || input.city.trim();
    const deliveryPostalCode = shipping.office?.postalCode || input.postalCode.trim();
    const reservationHours = input.paymentMethod === "CARD"
      ? CARD_ORDER_RESERVATION_HOURS
      : Math.max(24, Number(process.env.COD_ORDER_RESERVATION_HOURS) || COD_ORDER_RESERVATION_HOURS);
    const reservationExpiresAt = new Date(Date.now() + reservationHours * 60 * 60 * 1000);
    const order = await tx.order.create({
      data: {
        userId,
        total: orderTotal,
        vatRegisteredAtSale,
        vatRateAtSale,
        taxBaseAtSale,
        vatAmountAtSale,
        customerName: input.customerName.trim(),
        customerEmail: user.email,
        customerPhone: input.customerPhone.trim(),
        address: deliveryAddress,
        addressLine2: input.deliveryMethod === "ADDRESS" ? input.addressLine2?.trim() || null : null,
        city: deliveryCity,
        postalCode: deliveryPostalCode,
        country: input.country.trim() || "Bulgaria",
        deliveryMethod: input.deliveryMethod,
        paymentMethod: input.paymentMethod,
        shippingCost,
        promoCode: promo?.code || null,
        promoDiscount: pricing.discount,
        promoRegularPercent: promo?.regularDiscountPercent || 0,
        promoSalePercent: promo?.saleDiscountPercent || 0,
        courierProvider: input.courierProvider,
        courierOfficeId: shipping.office?.id,
        courierOfficeCode: shipping.office?.code,
        courierOfficeName: shipping.office?.name,
        courierOfficeAddress: shipping.office?.address,
        courierServiceId: shipping.serviceId,
        shippingQuotedCost: shipping.amount,
        shippingCurrency: shipping.currency,
        shippingQuoteSource: shipping.source,
        paymentStatus: input.paymentMethod === "CARD" ? "AWAITING_PAYMENT" : "PAYMENT_ON_DELIVERY",
        paymentProvider: input.paymentMethod === "CARD" ? "EPAY" : input.courierProvider,
        paymentExpiresAt: input.paymentMethod === "CARD" ? reservationExpiresAt : null,
        notes: input.notes?.trim() || null,
        items: { create: user.cart.items.map((item) => ({
          productId: item.productId, variantId: item.variantId, name: item.product.name,
          size: item.variant.size, sku: item.variant.sku, price: item.product.price, quantity: item.quantity,
        })) },
      },
      include: { items: true },
    });
    await tx.orderInventoryReservation.createMany({
      data: user.cart.items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        quantity: item.quantity,
        expiresAt: reservationExpiresAt,
      })),
    });
    await tx.inventoryReservation.deleteMany({
      where: { userId, variantId: { in: user.cart.items.map((item) => item.variantId) } },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.customerName.trim(),
        phone: input.customerPhone.trim() || null,
        ...(input.deliveryMethod === "ADDRESS" ? {
          address: input.address.trim() || null,
          addressLine2: input.addressLine2?.trim() || null,
          city: input.city.trim() || null,
          postalCode: input.postalCode.trim() || null,
          country: input.country.trim() || "Bulgaria",
        } : {}),
      },
    });
    await tx.cartItem.deleteMany({ where: { cartId: user.cart.id } });
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function syncProductStock(tx: Prisma.TransactionClient, productIds: number[]) {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  for (const productId of ids) {
    const aggregate = await tx.productVariant.aggregate({
      where: { productId, isActive: true },
      _sum: { stock: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { stock: Math.max(0, aggregate._sum.stock ?? 0) },
    });
  }
}

async function decreaseStock(tx: Prisma.TransactionClient, order: Awaited<ReturnType<typeof getOrderWithItems>>) {
  for (const item of order.items) {
    const changed = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity }, sold: { increment: item.quantity } },
    });
    if (changed.count !== 1) {
      throw new Error(`Недостатъчна наличност за ${item.name}, размер ${item.size}.`);
    }
    await tx.inventoryReservation.deleteMany({ where: { userId: order.userId, variantId: item.variantId } });
  }
  await tx.orderInventoryReservation.deleteMany({ where: { orderId: order.id } });
  await syncProductStock(tx, order.items.map((item) => item.productId));
}

async function restoreStock(tx: Prisma.TransactionClient, order: Awaited<ReturnType<typeof getOrderWithItems>>) {
  for (const item of order.items) {
    const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
    if (!variant) continue;
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: {
        stock: { increment: item.quantity },
        sold: { decrement: Math.min(variant.sold, item.quantity) },
      },
    });
  }
  await syncProductStock(tx, order.items.map((item) => item.productId));
}
async function getOrderWithItems(tx: Prisma.TransactionClient, orderId: number) {
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
}

export async function updateOrderStatusWithResult(orderId: number, nextStatus: OrderStatus) {
  return prisma.$transaction(async (tx) => {
    await releaseExpiredReservations(tx, { orderId });
    const order = await getOrderWithItems(tx, orderId);
    if (order.status === nextStatus) return { order, changed: false };
    if (order.status === OrderStatus.CANCELLED) throw new Error("Отказана поръчка не може да бъде променяна.");

    if (nextStatus === OrderStatus.CONFIRMED) {
      if (order.status !== OrderStatus.PENDING) throw new Error("Само нова поръчка може да бъде потвърдена.");
      if (order.paymentMethod === "CARD" && !["PAID", "PAID_REVIEW_REQUIRED"].includes(order.paymentStatus)) {
        throw new Error("Онлайн поръчката още не е платена. Изчакай потвърждение от ePay.");
      }
      await decreaseStock(tx, order);
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: nextStatus, confirmedAt: new Date() }, include: { items: true } });
      return { order: updated, changed: true };
    }
    if (nextStatus === OrderStatus.SHIPPED) {
      if (order.status !== OrderStatus.CONFIRMED) throw new Error("Поръчката трябва първо да бъде потвърдена.");
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: nextStatus, shippedAt: new Date() }, include: { items: true } });
      return { order: updated, changed: true };
    }
    if (nextStatus === OrderStatus.DELIVERED) {
      if (order.status !== OrderStatus.SHIPPED) throw new Error("Само изпратена поръчка може да бъде отбелязана като доставена.");
      await tx.order.update({ where: { id: orderId }, data: {
        status: nextStatus,
        deliveredAt: new Date(),
        ...(order.paymentMethod === "CASH_ON_DELIVERY" ? { paymentStatus: "PAID", paidAt: new Date() } : {}),
      } });
      const updated = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      return { order: updated, changed: true };
    }
    if (nextStatus === OrderStatus.CANCELLED) {
      if (order.status === OrderStatus.DELIVERED) throw new Error("Доставена поръчка не може да бъде отказана.");
      if (order.status === OrderStatus.SHIPPED) {
        throw new Error("Изпратена поръчка не може да бъде отказана директно, защото пратката вече е при куриера. Обработи връщането след получаването ѝ обратно.");
      }
      if (order.paymentMethod === "CARD" && ["PAID", "PAID_REVIEW_REQUIRED"].includes(order.paymentStatus)) {
        throw new Error("Платена с карта поръчка не може да бъде отказана преди плащането да бъде възстановено и отразено.");
      }
      if (order.status === OrderStatus.CONFIRMED) {
        await restoreStock(tx, order);
      }
      await tx.orderInventoryReservation.deleteMany({ where: { orderId } });
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: nextStatus, cancelledAt: new Date(), ...(order.paymentMethod === "CARD" ? { paymentStatus: "CANCELLED" } : {}) }, include: { items: true } });
      return { order: updated, changed: true };
    }
    throw new Error("Невалиден статус.");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateOrderStatus(orderId: number, nextStatus: OrderStatus) {
  return (await updateOrderStatusWithResult(orderId, nextStatus)).order;
}

export async function applyPaidCardNotificationWithResult(orderId: number, reference: string | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await getOrderWithItems(tx, orderId);
      if (order.paymentMethod !== "CARD") throw new Error("NOT_CARD_ORDER");
      if (order.paymentStatus === "PAID" && order.status !== "PENDING") {
        return { order, shouldSendConfirmationEmail: false };
      }
      if (order.status === "CANCELLED") throw new Error("CANCELLED_PAID_ORDER");

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          paymentProvider: "EPAY",
          paymentReference: reference,
          paidAt: order.paidAt ?? new Date(),
        },
      });

      if (order.status === "PENDING") {
        await decreaseStock(tx, order);
        const confirmed = await tx.order.update({
          where: { id: order.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
          include: { items: true },
        });
        return {
          order: confirmed,
          shouldSendConfirmationEmail: order.paymentStatus !== "PAID",
        };
      }

      return {
        order: await getOrderWithItems(tx, order.id),
        shouldSendConfirmationEmail: false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: {
          id: orderId,
          paymentMethod: "CARD",
          paymentStatus: { not: "PAID" },
        },
        data: {
          paymentStatus: "PAID_REVIEW_REQUIRED",
          paymentProvider: "EPAY",
          paymentReference: reference,
          paidAt: new Date(),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    throw error;
  }
}

export async function applyPaidCardNotification(orderId: number, reference: string | null) {
  return (await applyPaidCardNotificationWithResult(orderId, reference)).order;
}

export async function applyFailedCardNotification(orderId: number, status: "DENIED" | "EXPIRED") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod !== "CARD") return null;
    if (["PAID", "PAID_REVIEW_REQUIRED"].includes(order.paymentStatus)) return order;
    await tx.orderInventoryReservation.deleteMany({ where: { orderId } });
    return tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: status, paymentProvider: "EPAY" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export const confirmOrderAndDecreaseStock = (orderId: number) => updateOrderStatus(orderId, OrderStatus.CONFIRMED);
export const confirmOrderAndDecreaseStockWithResult = (orderId: number) => updateOrderStatusWithResult(orderId, OrderStatus.CONFIRMED);

export async function listAdminOrders() {
  return prisma.order.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              imageUrl: true,
              color: true,
              material: true,
              brand: true,
              productType: true,
            },
          },
          variant: { select: { id: true, size: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
