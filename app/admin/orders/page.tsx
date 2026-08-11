import OrdersTable from "@/components/admin/OrdersTable";
import { requireAdmin } from "@/lib/admin";
import { getUnreadAdminNavItemKeys } from "@/lib/admin-nav-alerts.server";
import { listAdminOrders } from "@/lib/orders";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { getSiteDesign } from "@/lib/site-design";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const admin = await requireAdmin();
  const [dbOrders, canConfirm, canShip, canDeliver, canCancel, design] = await Promise.all([
    listAdminOrders(),
    hasAdminPermission(admin.id, admin.role, "ORDERS:CONFIRM"),
    hasAdminPermission(admin.id, admin.role, "ORDERS:SHIP"),
    hasAdminPermission(admin.id, admin.role, "ORDERS:DELIVER"),
    hasAdminPermission(admin.id, admin.role, "ORDERS:CANCEL"),
    getSiteDesign(),
  ]);
  const unreadOrderKeys = await getUnreadAdminNavItemKeys(
    admin.id,
    "/admin/orders",
    dbOrders
      .filter((order) => order.status === "PENDING")
      .map((order) => ({
        itemKey: `order:${order.id}`,
        eventVersion: order.createdAt.toISOString(),
      })),
  );
  // Client Components can only receive serializable plain values. Prisma Decimal
  // instances (totalCost, grossProfit and item costing fields) must not cross
  // the Server Component boundary. Build the exact DTO required by OrdersTable.
  const orders = dbOrders.map((order) => ({
    id: order.id,
    unread: unreadOrderKeys.has(`order:${order.id}`),
    status: order.status,
    total: Number(order.total),
    shippingCost: Number(order.shippingCost),
    promoCode: order.promoCode,
    promoDiscount: Number(order.promoDiscount),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    address: order.address,
    city: order.city,
    postalCode: order.postalCode,
    country: order.country,
    deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    courierProvider: order.courierProvider,
    courierOfficeName: order.courierOfficeName,
    courierOfficeAddress: order.courierOfficeAddress,
    shippingQuoteSource: order.shippingQuoteSource,
    shipmentNumber: order.shipmentNumber,
    shipmentLabelUrl: order.shipmentLabelUrl,
    shipmentStatus: order.shipmentStatus,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      name: item.name,
      description: item.product.description,
      imageUrl: item.product.imageUrl,
      size: item.size,
      color: item.product.color,
      material: item.product.material,
      brand: item.product.brand,
      productType: item.product.productType,
      quantity: item.quantity,
      price: Number(item.price),
      lineTotal: Number(item.price) * item.quantity,
      sku: item.sku ?? item.variant.sku,
    })),
  }));

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>ПРОДАЖБИ И НАЛИЧНОСТ</span>
          <h1>Поръчки</h1>
        </div>
      </div>

      <OrdersTable brandName={design.brandName} orders={orders} permissions={{ canConfirm, canShip, canDeliver, canCancel }} />
    </main>
  );
}
