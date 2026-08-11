/* eslint-disable @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import InventoryTable from "@/components/admin/InventoryTable";
import { requireAdmin } from "@/lib/admin";
import { getUnreadAdminNavItemKeys } from "@/lib/admin-nav-alerts.server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/inventory";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const admin = await requireAdmin();

  const variants = await prisma.productVariant.findMany({
    include: {
      product: {
        select: { name: true, imageUrl: true },
      },
      reservations: {
        where: { expiresAt: { gt: new Date() } },
        select: { quantity: true },
      },
    },
    orderBy: [
      { product: { name: "asc" } },
      { size: "asc" },
    ],
  });

  const unreadVariantKeys = await getUnreadAdminNavItemKeys(
    admin.id,
    "/admin/inventory",
    variants
      .filter((variant) => variant.isActive && variant.stock <= variant.minStock)
      .map((variant) => ({
        itemKey: `variant:${variant.id}`,
        eventVersion: variant.updatedAt.toISOString(),
      })),
  );

  const rows = variants.map((variant) => {
    const reserved = variant.reservations.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    return {
      id: variant.id,
      size: variant.size,
      sku: variant.sku,
      stock: variant.stock,
      sold: variant.sold,
      minStock: variant.minStock,
      updatedAt: variant.updatedAt.toISOString(),
      unread: unreadVariantKeys.has(`variant:${variant.id}`),
      reserved,
      available: Math.max(variant.stock - reserved, 0),
      product: variant.product,
    };
  });

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>УПРАВЛЕНИЕ НА НАЛИЧНОСТТА</span>
          <h1>Склад</h1>
        </div>
      </div>

      <InventoryTable rows={rows} />
    </main>
  );
}
