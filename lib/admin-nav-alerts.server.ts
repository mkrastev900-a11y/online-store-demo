import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAdminNavAlerts } from "@/lib/admin-nav-alerts";

type AdminAlertAccess = { adminId: number; isSuperAdmin: boolean; permissions: readonly string[] };
const SEP = "\u001f";
const storedHref = (href: string, itemKey: string) => `${href}${SEP}${itemKey}`;
const canAccess = (access: AdminAlertAccess, permission: string) => access.isSuperAdmin || access.permissions.includes(permission);

export async function markAdminNavigationAlertViewed(adminId: number, href: string, itemKey: string, eventVersion: string) {
  const key = storedHref(href, itemKey);
  const viewedAt = new Date();
  const updated = await prisma.adminNavAlertView.updateMany({
    where: { userId: adminId, href: key, OR: [{ signature: null }, { signature: { not: eventVersion } }] },
    data: { viewedAt, signature: eventVersion },
  });
  if (updated.count) return { href, itemKey, newlyViewed: true };
  try {
    await prisma.adminNavAlertView.create({ data: { userId: adminId, href: key, viewedAt, signature: eventVersion } });
    return { href, itemKey, newlyViewed: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { href, itemKey, newlyViewed: false };
    throw error;
  }
}


export async function markAdminNavigationAlertsViewedBatch(
  adminId: number,
  items: ReadonlyArray<{ href: string; itemKey: string; eventVersion: string }>,
) {
  if (!items.length) return { newlyViewedCount: 0 };

  const deduped = new Map<string, { href: string; itemKey: string; eventVersion: string }>();
  for (const item of items) deduped.set(storedHref(item.href, item.itemKey), item);
  let newlyViewedCount = 0;
  for (const item of deduped.values()) {
    const result = await markAdminNavigationAlertViewed(adminId, item.href, item.itemKey, item.eventVersion);
    if (result.newlyViewed) newlyViewedCount += 1;
  }
  return { newlyViewedCount };
}

export async function getUnreadAdminNavItemKeys(adminId: number, href: string, items: ReadonlyArray<{ itemKey: string; eventVersion: string }>) {
  if (!items.length) return new Set<string>();
  const views = await prisma.adminNavAlertView.findMany({
    where: { userId: adminId, href: { in: items.map((item) => storedHref(href, item.itemKey)) } },
    select: { href: true, signature: true },
  });
  const signatures = new Map(views.map((view) => [view.href, view.signature]));
  return new Set(items.filter((item) => signatures.get(storedHref(href, item.itemKey)) !== item.eventVersion).map((item) => item.itemKey));
}

export async function getAdminNavigationAlerts(access: AdminAlertAccess) {
  const [pendingOrders, newCustomers, lowStockVariants, unreadSupportMessageRows] = await Promise.all([
    canAccess(access, "ORDERS:VIEW")
      ? prisma.order.findMany({
          where: { status: "PENDING" },
          select: { id: true, createdAt: true },
        })
      : [],
    canAccess(access, "CUSTOMERS:VIEW")
      ? prisma.user.findMany({
          where: { role: "CUSTOMER", crmStatus: "NEW", isActive: true },
          select: { id: true, updatedAt: true },
        })
      : [],
    canAccess(access, "INVENTORY:VIEW")
      ? prisma.productVariant.findMany({
          where: { isActive: true, product: { isActive: true } },
          select: { id: true, stock: true, minStock: true, updatedAt: true },
        })
      : [],
    canAccess(access, "ORDERS:VIEW")
      ? prisma.supportTicket.findMany({
          select: { adminReadAt: true, messages: { where: { isAdmin: false }, select: { createdAt: true } } },
        }).then((tickets) => [{ unreadMessages: tickets.reduce((sum, ticket) => sum + ticket.messages.filter((m) => !ticket.adminReadAt || m.createdAt > ticket.adminReadAt).length, 0) }]).catch(() => [])
      : [],
  ]);

  const activeWarningKeys = [
    !Boolean(process.env.SESSION_SECRET || process.env.AUTH_SECRET) ? "session-secret" : null,
    !Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) ? "cloudinary" : null,
    !Boolean(process.env.RESEND_API_KEY) ? "resend" : null,
  ].filter((key): key is string => Boolean(key));

  const [unreadOrders, unreadCustomers, unreadInventory, unreadWarnings] = await Promise.all([
    getUnreadAdminNavItemKeys(
      access.adminId,
      "/admin/orders",
      pendingOrders.map((order) => ({
        itemKey: `order:${order.id}`,
        eventVersion: order.createdAt.toISOString(),
      })),
    ),
    getUnreadAdminNavItemKeys(
      access.adminId,
      "/admin/customers",
      newCustomers.map((customer) => ({
        itemKey: `customer:${customer.id}`,
        eventVersion: customer.updatedAt.toISOString(),
      })),
    ),
    getUnreadAdminNavItemKeys(
      access.adminId,
      "/admin/inventory",
      lowStockVariants
        .filter((variant) => variant.stock <= variant.minStock)
        .map((variant) => ({
          itemKey: `variant:${variant.id}`,
          eventVersion: variant.updatedAt.toISOString(),
        })),
    ),
    getUnreadAdminNavItemKeys(
      access.adminId,
      "/admin/system-health",
      canAccess(access, "SYSTEM_HEALTH:VIEW")
        ? activeWarningKeys.map((key) => ({
            itemKey: `warning:${key}`,
            eventVersion: key,
          }))
        : [],
    ),
  ]);
  const unreadSupportMessages = Number(unreadSupportMessageRows[0]?.unreadMessages);

  return buildAdminNavAlerts({
    "/admin/orders": unreadOrders.size,
    "/admin/customers": unreadCustomers.size,
    "/admin/inventory": unreadInventory.size,
    "/admin/system-health": unreadWarnings.size,
    "/admin/support": Number.isFinite(unreadSupportMessages) ? Math.max(0, Math.floor(unreadSupportMessages)) : 0,
  });
}
