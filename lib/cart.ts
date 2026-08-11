/* eslint-disable @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planCheckoutReservations } from "@/lib/cart-reservation";
import {
  getReservedQuantity,
  RESERVATION_MINUTES,
  releaseExpiredReservations,
  reserveVariantInTransaction,
} from "@/lib/inventory";

export type RemovedCheckoutCartItem = {
  id: number;
  name: string;
  size: string;
  quantity: number;
  availableStock: number;
};

async function ensureCart(userId: number) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
}

async function getReservedQuantitiesForVariants(
  variantIds: number[],
  excludeUserId?: number,
) {
  const uniqueVariantIds = [...new Set(variantIds.filter((id) => Number.isFinite(id) && id > 0))];
  const reservedByVariant = new Map<number, number>();
  if (!uniqueVariantIds.length) return reservedByVariant;

  const now = new Date();

  const cartReservations = await prisma.inventoryReservation.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: uniqueVariantIds },
      expiresAt: { gt: now },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    _sum: { quantity: true },
  });

  for (const reservation of cartReservations) {
    reservedByVariant.set(
      reservation.variantId,
      (reservedByVariant.get(reservation.variantId) ?? 0) + (reservation._sum.quantity ?? 0),
    );
  }

  try {
    const orderReservations = await prisma.orderInventoryReservation.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: uniqueVariantIds },
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    });

    for (const reservation of orderReservations) {
      reservedByVariant.set(
        reservation.variantId,
        (reservedByVariant.get(reservation.variantId) ?? 0) + (reservation._sum.quantity ?? 0),
      );
    }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") {
      throw error;
    }
  }

  return reservedByVariant;
}

export async function getCart(userId: number) {
  // Read paths stay read-only. A cart is created lazily only by mutation flows.
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return { items: [], totalItems: 0, subtotal: 0 };

  // Do not include product/variant relations here. Some deployed databases still
  // do not have the newer Product.sectionId column, and relation includes can
  // make Prisma try to read that missing column. Keep the cart compatible by
  // loading only real/safe columns explicitly.
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: { id: true, productId: true, variantId: true, quantity: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!items.length) {
    return { items: [], totalItems: 0, subtotal: 0 };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
    select: { id: true, name: true, slug: true, sku: true, description: true, material: true, color: true, price: true, imageUrl: true, isActive: true },
  });
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...new Set(items.map((item) => item.variantId))] } },
    select: { id: true, productId: true, size: true, sku: true, stock: true, isActive: true },
  });

  const productsById = new Map(products.map((product) => [product.id, product]));
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const validItems = items.filter((item) => {
    const product = productsById.get(item.productId);
    const variant = variantsById.get(item.variantId);
    return Boolean(product?.isActive && variant?.isActive && variant.productId === item.productId);
  });

  const invalidItems = items.filter((item) => !validItems.includes(item));
  const invalidItemIds = invalidItems.map((item) => item.id);
  if (invalidItemIds.length) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { id: { in: invalidItemIds }, cartId: cart.id } });
      const invalidVariantIds = [...new Set(invalidItems.map((item) => item.variantId))];
      if (invalidVariantIds.length) {
        await tx.inventoryReservation.deleteMany({ where: { userId, variantId: { in: invalidVariantIds } } });
      }
    });
  }

  const reservedByVariant = await getReservedQuantitiesForVariants(
    validItems.map((item) => item.variantId),
    userId,
  );

  const mapped = validItems.map((item) => {
    const product = productsById.get(item.productId)!;
    const variant = variantsById.get(item.variantId)!;
    const price = Number(product.price);
    const availableStock = Math.max(variant.stock - (reservedByVariant.get(item.variantId) ?? 0), 0);
    return {
      id: item.id,
      quantity: item.quantity,
      productId: item.productId,
      variantId: item.variantId,
      size: variant.size,
      productSku: product.sku,
      variantSku: variant.sku,
      name: product.name,
      slug: product.slug,
      description: product.description,
      material: product.material,
      color: product.color,
      price,
      imageUrl: product.imageUrl,
      availableStock,
      lineTotal: price * item.quantity,
    };
  });

  return {
    items: mapped,
    totalItems: mapped.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: mapped.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}


export async function getVariantAddableQuantities(
  userId: number | null | undefined,
  variants: Array<{ id: number; stock: number }>,
) {
  const variantIds = [...new Set(variants.map((variant) => variant.id).filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Map<number, number>();
  for (const variant of variants) {
    result.set(variant.id, Math.max(0, Math.floor(Number(variant.stock) || 0)));
  }
  if (!variantIds.length) return result;

  const reservedByOthers = await getReservedQuantitiesForVariants(
    variantIds,
    userId ?? undefined,
  );

  const quantityInCurrentCart = new Map<number, number>();
  if (userId) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (cart) {
      const cartItems = await prisma.cartItem.findMany({
        where: { cartId: cart.id, variantId: { in: variantIds } },
        select: { variantId: true, quantity: true },
      });

      for (const item of cartItems) {
        quantityInCurrentCart.set(
          item.variantId,
          (quantityInCurrentCart.get(item.variantId) ?? 0) + item.quantity,
        );
      }
    }
  }

  for (const variant of variants) {
    result.set(
      variant.id,
      Math.max(
        0,
        Math.floor(Number(variant.stock) || 0)
          - (reservedByOthers.get(variant.id) ?? 0)
          - (quantityInCurrentCart.get(variant.id) ?? 0),
      ),
    );
  }

  return result;
}

export async function addCartItem(
  userId: number,
  productId: number,
  variantId: number,
  quantity: number,
) {
  const cart = await ensureCart(userId);
  const safeQuantity = Math.max(1, Math.floor(quantity));
  let safeVariantId = Number.isFinite(variantId) && variantId > 0 ? Math.floor(variantId) : 0;

  if (!safeVariantId) {
    const firstAvailableVariant = await prisma.productVariant.findFirst({
      where: { productId, isActive: true, stock: { gt: 0 } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (!firstAvailableVariant) {
      throw new Error("Няма наличен размер за този продукт.");
    }
    safeVariantId = firstAvailableVariant.id;
  }

  const linked = await prisma.productVariant.findFirst({
    where: {
      id: safeVariantId,
      productId,
      isActive: true,
      product: { isActive: true },
    },
    select: { id: true },
  });
  if (!linked) {
    throw new Error("Избраният размер не принадлежи на този продукт или вече не е активен.");
  }

  await prisma.$transaction(async (tx) => {
    // Serialize mutations of one user's cart so two rapid clicks cannot create
    // a reservation/cart quantity split-brain.
    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: safeVariantId } },
      select: { quantity: true },
    });
    const nextQuantity = (existing?.quantity ?? 0) + safeQuantity;

    await reserveVariantInTransaction(tx, userId, safeVariantId, nextQuantity);
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: safeVariantId } },
      update: { quantity: nextQuantity, productId },
      create: { cartId: cart.id, productId, variantId: safeVariantId, quantity: nextQuantity },
      select: { id: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return getCart(userId);
}

export async function updateCartItem(
  userId: number,
  itemId: number,
  quantity: number,
) {
  const cart = await ensureCart(userId);
  const nextQuantity = Math.max(0, Math.floor(quantity));

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true, variantId: true, quantity: true },
  });

  if (!item) {
    throw new Error("Артикулът не е намерен.");
  }

  if (nextQuantity <= 0) {
    await prisma.$transaction(async (tx) => {
      const freshItem = await tx.cartItem.findFirst({
        where: { id: item.id, cartId: cart.id },
        select: { id: true, variantId: true },
      });
      if (!freshItem) return;
      await tx.cartItem.deleteMany({ where: { id: freshItem.id, cartId: cart.id } });
      await tx.inventoryReservation.deleteMany({ where: { userId, variantId: freshItem.variantId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return getCart(userId);
  }

  // Намаляването не се нуждае от тежка stock/reservation проверка.
  // Обновяваме директно количеството и резервацията, за да реагира количката бързо.
  if (nextQuantity <= item.quantity) {
    await prisma.$transaction(async (tx) => {
      const freshItem = await tx.cartItem.findFirst({
        where: { id: item.id, cartId: cart.id },
        select: { id: true, variantId: true, quantity: true },
      });
      if (!freshItem) throw new Error("Артикулът не е намерен.");
      const safeNext = Math.min(nextQuantity, freshItem.quantity);
      await tx.cartItem.update({
        where: { id: freshItem.id },
        data: { quantity: safeNext },
        select: { id: true },
      });
      await tx.inventoryReservation.updateMany({
        where: { userId, variantId: freshItem.variantId },
        data: {
          quantity: safeNext,
          expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return getCart(userId);
  }

  await prisma.$transaction(async (tx) => {
    const freshItem = await tx.cartItem.findFirst({
      where: { id: item.id, cartId: cart.id },
      select: { id: true, variantId: true },
    });
    if (!freshItem) throw new Error("Артикулът не е намерен.");
    await reserveVariantInTransaction(tx, userId, freshItem.variantId, nextQuantity);
    await tx.cartItem.update({
      where: { id: freshItem.id },
      data: { quantity: nextQuantity },
      select: { id: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return getCart(userId);
}

export async function removeCartItem(userId: number, itemId: number) {
  const cart = await ensureCart(userId);
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true, variantId: true },
  });

  if (item) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { id: item.id, cartId: cart.id } });
      await tx.inventoryReservation.deleteMany({ where: { userId, variantId: item.variantId } });
    });
  }

  return getCart(userId);
}

export async function renewCheckoutReservations(userId: number) {
  const removedItems = await prisma.$transaction(async (tx) => {
    await releaseExpiredReservations(tx, { userId });
    const cartIdentity = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cartIdentity) return [] as RemovedCheckoutCartItem[];
    const cart = await tx.cart.findUnique({
      where: { id: cartIdentity.id },
      include: { items: true },
    });
    if (!cart?.items.length) return [] as RemovedCheckoutCartItem[];

    const products = await tx.product.findMany({
      where: { id: { in: [...new Set(cart.items.map((item) => item.productId))] } },
      select: { id: true, name: true, isActive: true },
    });
    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...new Set(cart.items.map((item) => item.variantId))] } },
      select: { id: true, productId: true, size: true, sku: true, stock: true, isActive: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    const candidates = [];
    for (const item of cart.items) {
      const product = productsById.get(item.productId);
      const variant = variantsById.get(item.variantId);
      candidates.push({
        cartItemId: item.id,
        variantId: item.variantId,
        requestedQuantity: item.quantity,
        stock: variant?.stock ?? 0,
        reservedByOthers: await getReservedQuantity(item.variantId, userId, tx),
        active: Boolean(product?.isActive && variant?.isActive),
      });
    }
    const plan = planCheckoutReservations(candidates);
    const itemsById = new Map(cart.items.map((item) => [item.id, item]));
    const removed: RemovedCheckoutCartItem[] = plan.unavailable.map((decision) => {
      const item = itemsById.get(decision.cartItemId)!;
      const product = productsById.get(item.productId);
      const variant = variantsById.get(item.variantId);
      return {
        id: item.id,
        name: product?.name ?? "Продукт",
        size: variant?.size ?? "—",
        quantity: item.quantity,
        availableStock: decision.availableStock,
      };
    });

    if (plan.unavailable.length) {
      await tx.cartItem.deleteMany({ where: { id: { in: plan.unavailable.map((item) => item.cartItemId) } } });
      await tx.inventoryReservation.deleteMany({ where: { userId, variantId: { in: plan.unavailable.map((item) => item.variantId) } } });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);
    for (const decision of plan.renewable) {
      const item = itemsById.get(decision.cartItemId)!;
      await tx.inventoryReservation.upsert({
        where: { userId_variantId: { userId, variantId: decision.variantId } },
        update: { quantity: decision.requestedQuantity, expiresAt },
        create: { userId, variantId: decision.variantId, quantity: decision.requestedQuantity, expiresAt },
      });
    }

    return removed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { removedItems, cart: await getCart(userId), reservationMinutes: RESERVATION_MINUTES };
}
