import { hasAdminPermission, requireAdminPermission } from "@/lib/admin-permissions";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "@/components/admin/DashboardCharts";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
const statusLabel: Record<string, string> = { PENDING: "Нова", CONFIRMED: "Потвърдена", SHIPPED: "Изпратена", DELIVERED: "Доставена", CANCELLED: "Отказана" };
const validRevenueStatuses = ["CONFIRMED", "SHIPPED", "DELIVERED"] as const;

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }

export default async function AdminPage() {
  const admin = await requireAdminPermission("DASHBOARD:VIEW");
  const canCreateProduct = await hasAdminPermission(admin.id, admin.role, "PRODUCTS:CREATE");
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  const chartStart = startOfDay(new Date(now.getTime() - 13 * 86400000));

  const [products, activeProducts, orders, pendingOrders, shippedOrders, customers, newCustomers, totalRevenue, todayRevenue, monthRevenue, lowStock, recentOrders, topItems, chartOrders] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "SHIPPED" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: monthStart } } }),
    prisma.order.aggregate({ where: { status: { in: [...validRevenueStatuses] } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { status: { in: [...validRevenueStatuses] }, createdAt: { gte: today } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { status: { in: [...validRevenueStatuses] }, createdAt: { gte: monthStart } }, _sum: { total: true } }),
    prisma.productVariant.findMany({ where: { isActive: true, stock: { lte: 3 } }, include: { product: { select: { name: true, imageUrl: true } } }, orderBy: { stock: "asc" }, take: 8 }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 7, select: { id: true, customerName: true, total: true, status: true, createdAt: true } }),
    prisma.orderItem.groupBy({ by: ["name"], _sum: { quantity: true, price: true }, orderBy: { _sum: { quantity: "desc" } }, take: 6 }),
    prisma.order.findMany({ where: { createdAt: { gte: chartStart } }, select: { createdAt: true, total: true, status: true } }),
  ]);

  const points = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(chartStart.getTime() + index * 86400000);
    const next = new Date(date.getTime() + 86400000);
    const dayOrders = chartOrders.filter((order) => order.createdAt >= date && order.createdAt < next);
    return {
      label: date.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" }),
      orders: dayOrders.length,
      revenue: dayOrders.filter((order) => validRevenueStatuses.includes(order.status as typeof validRevenueStatuses[number])).reduce((sum, order) => sum + Number(order.total), 0),
    };
  });
  const revenue = Number(totalRevenue._sum.total ?? 0);
  const averageOrder = orders ? revenue / orders : 0;

  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>ОБЩ ПРЕГЛЕД</span><h1>Табло</h1></div>{canCreateProduct ? <Link href="/admin/products/new">Добави нов продукт</Link> : null}</div>
    <div className={styles.dashboardStats}>
      <article><span>Оборот днес</span><strong>{Number(todayRevenue._sum.total ?? 0).toFixed(2)} €</strong><small>Потвърдени продажби</small></article>
      <article><span>Оборот този месец</span><strong>{Number(monthRevenue._sum.total ?? 0).toFixed(2)} €</strong><small>От {monthStart.toLocaleDateString("bg-BG")}</small></article>
      <article><span>Общ оборот</span><strong>{revenue.toFixed(2)} €</strong><small>Потвърдени, изпратени и доставени</small></article>
      <article><span>Средна поръчка</span><strong>{averageOrder.toFixed(2)} €</strong><small>Средно за всички поръчки</small></article>
      <article><span>Нови поръчки</span><strong>{pendingOrders}</strong><small>От общо {orders}</small></article>
      <article><span>Изпратени</span><strong>{shippedOrders}</strong><small>Чакат доставка</small></article>
      <article><span>Клиенти</span><strong>{customers}</strong><small>{newCustomers} нови този месец</small></article>
      <article><span>Активни продукти</span><strong>{activeProducts}</strong><small>От общо {products}</small></article>
    </div>
    <DashboardCharts points={points} />
    <div className={styles.dashboardGrid}>
      <section className={styles.dashboardPanel}><div className={styles.panelTitle}><div><span>ПОСЛЕДНИ</span><h2>Поръчки</h2></div><Link href="/admin/orders">Виж всички</Link></div>
        <div className={styles.recentOrders}>{recentOrders.length ? recentOrders.map((order) => <Link href="/admin/orders" key={order.id}><div><b>#{order.id} · {order.customerName}</b><small>{new Date(order.createdAt).toLocaleDateString("bg-BG")}</small></div><div><span>{statusLabel[order.status]}</span><strong>{Number(order.total).toFixed(2)} €</strong></div></Link>) : <p>Все още няма поръчки.</p>}</div>
      </section>
      <section className={styles.dashboardPanel}><div className={styles.panelTitle}><div><span>ВНИМАНИЕ</span><h2>Ниска наличност</h2></div><Link href="/admin/inventory">Отвори склада</Link></div>
        <div className={styles.stockList}>{lowStock.length ? lowStock.map((variant) => <div key={variant.id}><span>{variant.product.name}<small>Размер {variant.size}</small></span><strong>{variant.stock} бр.</strong></div>) : <p>Няма артикули с ниска наличност.</p>}</div>
      </section>
      <section className={`${styles.dashboardPanel} ${styles.widePanel}`}><div className={styles.panelTitle}><div><span>НАЙ-ТЪРСЕНИ</span><h2>Най-продавани артикули</h2></div></div>
        <div className={styles.topProducts}>{topItems.length ? topItems.map((item, index) => <div key={item.name}><b>{index + 1}</b><span>{item.name}</span><strong>{item._sum.quantity ?? 0} бр.</strong></div>) : <p>Няма достатъчно данни за продажби.</p>}</div>
      </section>
    </div>
  </main>;
}
