import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RESERVATION_MINUTES = 15;
export const CARD_ORDER_RESERVATION_HOURS = 24;
export const COD_ORDER_RESERVATION_HOURS = 72;

type Tx = Prisma.TransactionClient;

type ExpiredOrderReservation = Prisma.OrderInventoryReservationGetPayload<{
  include: {
    variant: true;
    order: { select: { id: true; status: true; paymentStatus: true } };
  };
}>;

export type ReservationCleanupScope = {
  userId?: number;
  variantId?: number;
  orderId?: number;
};

export async function releaseExpiredReservations(
  client: PrismaClient | Tx = prisma,
  scope: ReservationCleanupScope = {},
) {
  const now = new Date();

  // Cart reservations are only cleaned when the caller identifies the affected
  // user/variant. Read-only stock/cart queries do not need cleanup because every
  // availability query already ignores expiresAt <= now.
  let deletedCartReservations = 0;
  if (scope.userId || scope.variantId) {
    const result = await client.inventoryReservation.deleteMany({
      where: {
        expiresAt: { lte: now },
        ...(scope.userId ? { userId: scope.userId } : {}),
        ...(scope.variantId ? { variantId: scope.variantId } : {}),
      },
    });
    deletedCartReservations = result.count;
  }

  const orderReservationWhere: Prisma.OrderInventoryReservationWhereInput = {
    expiresAt: { lte: now },
    ...(scope.orderId ? { orderId: scope.orderId } : {}),
    ...(scope.variantId ? { variantId: scope.variantId } : {}),
    ...(scope.userId ? { order: { userId: scope.userId } } : {}),
  };

  let expiredOrders: ExpiredOrderReservation[] = [];
  if (scope.userId || scope.variantId || scope.orderId) {
    try {
      expiredOrders = await client.orderInventoryReservation.findMany({
        where: orderReservationWhere,
        include: { variant: true, order: { select: { id: true, status: true, paymentStatus: true } } },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") throw error;
    }
  }

  if (expiredOrders.length) {
    const orderIds = [...new Set(expiredOrders.map((item) => item.orderId))];
    await client.orderInventoryReservation.deleteMany({ where: { id: { in: expiredOrders.map((item) => item.id) } } });
    await client.order.updateMany({
      where: {
        id: { in: orderIds },
        status: "PENDING",
        paymentStatus: { in: ["PENDING", "AWAITING_PAYMENT", "PAYMENT_ON_DELIVERY"] },
      },
      data: { paymentStatus: "RESERVATION_EXPIRED" },
    });
  }

  return deletedCartReservations + expiredOrders.length;
}

export async function getReservedQuantity(
  variantId: number,
  excludeUserId?: number,
  client: PrismaClient | Tx = prisma,
) {
  const now = new Date();
  const cartReservations = await client.inventoryReservation.aggregate({
    where: {
      variantId,
      expiresAt: { gt: now },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    _sum: { quantity: true },
  });

  let orderReserved = 0;
  try {
    const orderReservations = await client.orderInventoryReservation.aggregate({
      where: { variantId, expiresAt: { gt: now } },
      _sum: { quantity: true },
    });
    orderReserved = orderReservations._sum.quantity ?? 0;
  } catch (error) {
    // Older/local databases may not have the order reservation table yet.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") {
      throw error;
    }
  }

  return (cartReservations._sum.quantity ?? 0) + orderReserved;
}

export async function reserveVariantInTransaction(
  tx: Tx,
  userId: number,
  variantId: number,
  requestedQuantity: number,
) {
  await releaseExpiredReservations(tx, { variantId });

  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { id: true, name: true, isActive: true } } },
  });

  if (!variant || !variant.isActive || !variant.product.isActive) {
    throw new Error("Този размер не е активен.");
  }

  const reservedByOthers = await getReservedQuantity(variantId, userId, tx);
  const available = variant.stock - reservedByOthers;

  if (requestedQuantity < 1 || requestedQuantity > available) {
    throw new Error(`Налични за размер ${variant.size}: ${Math.max(available, 0)} бр.`);
  }

  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);
  return tx.inventoryReservation.upsert({
    where: { userId_variantId: { userId, variantId } },
    update: { quantity: requestedQuantity, expiresAt },
    create: { userId, variantId, quantity: requestedQuantity, expiresAt },
  });
}

export async function reserveVariant(
  userId: number,
  variantId: number,
  requestedQuantity: number,
) {
  return prisma.$transaction(
    (tx) => reserveVariantInTransaction(tx, userId, variantId, requestedQuantity),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function releaseUserVariantReservation(
  userId: number,
  variantId: number,
) {
  return prisma.inventoryReservation.deleteMany({
    where: { userId, variantId },
  });
}

export async function getAvailableStock(
  variantId: number,
  userId?: number,
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) return 0;

  const reserved = await getReservedQuantity(
    variantId,
    userId,
  );

  return Math.max(variant.stock - reserved, 0);
}

export async function adjustVariantStock(input: {
  variantId: number;
  newStock: number;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
    });

    if (!variant) {
      throw new Error("Размерът не е намерен.");
    }

    if (!Number.isInteger(input.newStock) || input.newStock < 0) {
      throw new Error("Наличността трябва да е цяло число 0 или повече.");
    }

    const updated = await tx.productVariant.update({
      where: { id: input.variantId },
      data: { stock: input.newStock },
    });
    const total = await tx.productVariant.aggregate({ where: { productId: updated.productId, isActive: true }, _sum: { stock: true } });
    await tx.product.update({ where: { id: updated.productId }, data: { stock: total._sum.stock ?? 0 } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
