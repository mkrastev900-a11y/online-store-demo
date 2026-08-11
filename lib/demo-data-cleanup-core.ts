import { Prisma } from "@prisma/client";

export type DemoOrderForCleanup = {
  id: number;
  status: string;
  items: Array<{
    productId: number;
    quantity: number;
    variantId: number;
    rmaItems: Array<{ restockedQuantity: number }>;
  }>;
};

export type StockRestoreItem = {
  productId: number;
  quantity: number;
  variantId: number;
};

export type DemoCleanupTransactionResult = {
  attachmentsDeleted: number;
  attachmentFiles: Array<{
    fileName: string;
    mimeType: string;
    publicId: string;
    resourceType: string;
    size: number;
    url: string;
  }>;
  auditLogsDeleted: number;
  cartItemsDeleted: number;
  crmRecordsDeleted: number;
  favoritesDeleted: number;
  inventoryReservationsDeleted: number;
  ordersDeleted: number;
  productViewsDeleted: number;
  rateLimitBucketsDeleted: number;
  stockUnitsRestored: number;
  ticketsDeleted: number;
  tokensDeleted: number;
  usersDeleted: number;
};

const STOCK_DECREMENTING_STATUSES = new Set(["CONFIRMED", "SHIPPED", "DELIVERED"]);

// PERSISTENT DEMO CONFIGURATION:
// SiteDesignSettings is intentionally NEVER touched by the 30-minute demo cleanup.
// It stores the storefront design and the social-network configuration
// (facebookUrl / instagramUrl / tiktokUrl plus enabled flags in designTokensJson).
// These values remain until an administrator changes them manually.

export function calculateStockRestorePlan(orders: DemoOrderForCleanup[]): StockRestoreItem[] {
  const plan = new Map<number, StockRestoreItem>();

  for (const order of orders) {
    if (!STOCK_DECREMENTING_STATUSES.has(order.status)) continue;
    for (const item of order.items) {
      const alreadyRestocked = item.rmaItems.reduce(
        (sum, rmaItem) => sum + Math.max(0, rmaItem.restockedQuantity),
        0,
      );
      const quantity = Math.max(0, item.quantity - Math.min(item.quantity, alreadyRestocked));
      if (!quantity) continue;
      const current = plan.get(item.variantId);
      plan.set(item.variantId, {
        productId: item.productId,
        quantity: (current?.quantity || 0) + quantity,
        variantId: item.variantId,
      });
    }
  }

  return [...plan.values()];
}

export async function cleanupDemoDataInTransaction(
  tx: Prisma.TransactionClient,
  options: { cutoff: Date; now: Date; protectedAdminEmail?: string | null },
): Promise<DemoCleanupTransactionResult> {
  const protectedAdminEmail = options.protectedAdminEmail?.trim().toLowerCase() || null;
  const expiredUsers = await tx.user.findMany({
    where: {
      createdAt: { lt: options.cutoff },
      role: "CUSTOMER",
      ...(protectedAdminEmail ? { email: { not: protectedAdminEmail } } : {}),
    },
    select: { id: true },
  });
  const userIds = expiredUsers.map((user) => user.id);

  const orderWhere: Prisma.OrderWhereInput = userIds.length
    ? { OR: [{ createdAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
    : { createdAt: { lt: options.cutoff } };
  const orders = await tx.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      status: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          variantId: true,
          rmaItems: { select: { restockedQuantity: true } },
        },
      },
    },
  });
  const orderIds = orders.map((order) => order.id);

  const rmaLinkConditions: Prisma.SupportRmaRequestWhereInput[] = [];
  if (userIds.length) rmaLinkConditions.push({ userId: { in: userIds } });
  if (orderIds.length) rmaLinkConditions.push({ orderId: { in: orderIds } });
  const linkedRmaTickets = rmaLinkConditions.length
    ? await tx.supportRmaRequest.findMany({
        where: { OR: rmaLinkConditions },
        select: { ticketId: true },
      })
    : [];

  const ticketConditions: Prisma.SupportTicketWhereInput[] = [
    { orderId: null, createdAt: { lt: options.cutoff } },
  ];
  if (userIds.length) ticketConditions.push({ userId: { in: userIds } });
  if (orderIds.length) ticketConditions.push({ orderId: { in: orderIds } });
  if (linkedRmaTickets.length) {
    ticketConditions.push({ id: { in: linkedRmaTickets.map((request) => request.ticketId) } });
  }
  const tickets = await tx.supportTicket.findMany({
    where: { OR: ticketConditions },
    select: { id: true },
  });
  const ticketIds = tickets.map((ticket) => ticket.id);

  const attachmentFiles = ticketIds.length
    ? await tx.supportTicketAttachment.findMany({
        where: { ticketId: { in: ticketIds } },
        select: {
          fileName: true,
          mimeType: true,
          publicId: true,
          resourceType: true,
          size: true,
          url: true,
        },
      })
    : [];
  const rmaRequests = ticketIds.length
    ? await tx.supportRmaRequest.findMany({
        where: { ticketId: { in: ticketIds } },
        select: { id: true },
      })
    : [];
  const rmaRequestIds = rmaRequests.map((request) => request.id);
  const targetCarts = userIds.length
    ? await tx.cart.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const cartIds = targetCarts.map((cart) => cart.id);

  const restorePlan = calculateStockRestorePlan(orders as DemoOrderForCleanup[]);
  const affectedProductIds = new Set<number>();
  let stockUnitsRestored = 0;
  for (const item of restorePlan) {
    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { sold: true },
    });
    if (!variant) continue;
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: {
        sold: { decrement: Math.min(variant.sold, item.quantity) },
        stock: { increment: item.quantity },
      },
    });
    affectedProductIds.add(item.productId);
    stockUnitsRestored += item.quantity;
  }
  for (const productId of affectedProductIds) {
    const aggregate = await tx.productVariant.aggregate({
      where: { productId, isActive: true },
      _sum: { stock: true },
    });
    await tx.product.updateMany({
      where: { id: productId },
      data: { stock: Math.max(0, aggregate._sum.stock || 0) },
    });
  }

  const auditLogConditions: Prisma.AuditLogWhereInput[] = [
    { entityType: "EmailDelivery", createdAt: { lt: options.cutoff } },
  ];
  if (userIds.length) {
    auditLogConditions.push(
      { actorId: { in: userIds } },
      { entityType: "User", entityId: { in: userIds.map(String) } },
    );
  }
  const auditLogs = await tx.auditLog.deleteMany({ where: { OR: auditLogConditions } });
  const adminNavViews = await tx.adminNavAlertView.deleteMany({
    where: userIds.length
      ? { OR: [{ viewedAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { viewedAt: { lt: options.cutoff } },
  });
  const passwordTokens = await tx.passwordResetToken.deleteMany({
    where: userIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const verificationCodes = await tx.emailVerificationCode.deleteMany({
    where: userIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const customerNotes = await tx.customerNote.deleteMany({
    where: userIds.length
      ? {
          OR: [
            { createdAt: { lt: options.cutoff } },
            { customerId: { in: userIds } },
            { authorId: { in: userIds } },
          ],
        }
      : { createdAt: { lt: options.cutoff } },
  });
  const tagAssignments = await tx.customerTagAssignment.deleteMany({
    where: userIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { customerId: { in: userIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const cartItems = await tx.cartItem.deleteMany({
    where: cartIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { cartId: { in: cartIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const favorites = await tx.favorite.deleteMany({
    where: userIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const productViews = await tx.productView.deleteMany({
    where: userIds.length
      ? { OR: [{ viewedAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { viewedAt: { lt: options.cutoff } },
  });
  const inventoryReservations = await tx.inventoryReservation.deleteMany({
    where: userIds.length
      ? { OR: [{ createdAt: { lt: options.cutoff } }, { userId: { in: userIds } }] }
      : { createdAt: { lt: options.cutoff } },
  });
  const rateLimitBuckets = await tx.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: options.now } },
  });

  let attachmentsDeleted = 0;
  let ticketsDeleted = 0;
  if (ticketIds.length) {
    attachmentsDeleted = (await tx.supportTicketAttachment.deleteMany({ where: { ticketId: { in: ticketIds } } })).count;
    await tx.supportTicketInternalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.supportTicketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } });
    if (rmaRequestIds.length) {
      await tx.supportRmaItem.deleteMany({ where: { requestId: { in: rmaRequestIds } } });
      await tx.supportRmaRequest.deleteMany({ where: { id: { in: rmaRequestIds } } });
    }
    ticketsDeleted = (await tx.supportTicket.deleteMany({ where: { id: { in: ticketIds } } })).count;
  }

  let ordersDeleted = 0;
  if (orderIds.length) {
    await tx.orderInventoryReservation.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    ordersDeleted = (await tx.order.deleteMany({ where: { id: { in: orderIds } } })).count;
  }

  if (userIds.length) {
    await tx.adminPermission.deleteMany({ where: { userId: { in: userIds } } });
    await tx.cart.deleteMany({ where: { id: { in: cartIds } } });
  }
  const usersDeleted = userIds.length
    ? (await tx.user.deleteMany({
        where: {
          id: { in: userIds },
          role: "CUSTOMER",
          ...(protectedAdminEmail ? { email: { not: protectedAdminEmail } } : {}),
        },
      })).count
    : 0;

  return {
    attachmentsDeleted,
    attachmentFiles,
    auditLogsDeleted: auditLogs.count + adminNavViews.count,
    cartItemsDeleted: cartItems.count,
    crmRecordsDeleted: customerNotes.count + tagAssignments.count,
    favoritesDeleted: favorites.count,
    inventoryReservationsDeleted: inventoryReservations.count,
    ordersDeleted,
    productViewsDeleted: productViews.count,
    rateLimitBucketsDeleted: rateLimitBuckets.count,
    stockUnitsRestored,
    ticketsDeleted,
    tokensDeleted: passwordTokens.count + verificationCodes.count,
    usersDeleted,
  };
}
