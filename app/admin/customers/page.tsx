import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { getUnreadAdminNavItemKeys } from "@/lib/admin-nav-alerts.server";
import { prisma } from "@/lib/prisma";
import styles from "./customers.module.css";

export const dynamic = "force-dynamic";

const crmLabel: Record<string, string> = {
  NEW: "Нов",
  ACTIVE: "Активен",
  VIP: "VIP",
  RISK: "Рисков",
  INACTIVE: "Неактивен",
  BLOCKED: "Блокиран",
};

type CustomerWithRelations = Prisma.UserGetPayload<{
  include: {
    orders: {
      select: { total: true; grossProfit: true; createdAt: true };
    };
    crmTagAssignments: { include: { tag: true } };
  };
}>;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const sort = typeof params.sort === "string" ? params.sort : "newest";
  const where = {
    role: "CUSTOMER" as const,
    ...(status !== "all" ? { crmStatus: status as "NEW"|"ACTIVE"|"VIP"|"RISK"|"INACTIVE"|"BLOCKED" } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { city: { contains: q } }, { crmTagAssignments: { some: { tag: { name: { contains: q } } } } }] } : {}),
  };
  const users: CustomerWithRelations[] = await prisma.user.findMany({
    where,
    include: {
      orders: { select: { total: true, grossProfit: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      crmTagAssignments: { include: { tag: true } },
    },
    orderBy: sort === "oldest" ? { createdAt: "asc" } : sort === "name" ? { name: "asc" } : { createdAt: "desc" },
    take: 250,
  });
  const rows = users.map((user) => ({
    ...user,
    orderCount: user.orders.length,
    spent: user.orders.reduce((sum, order) => sum + Number(order.total), 0),
    profit: user.orders.reduce((sum, order) => sum + Number(order.grossProfit), 0),
    lastOrderAt: user.orders[0]?.createdAt ?? null,
  })).sort((a, b) => sort === "spent" ? b.spent - a.spent : sort === "orders" ? b.orderCount - a.orderCount : sort === "profit" ? b.profit - a.profit : 0);
  const unreadCustomerKeys = await getUnreadAdminNavItemKeys(
    admin.id,
    "/admin/customers",
    rows
      .filter((user) => user.crmStatus === "NEW" && user.isActive)
      .map((user) => ({
        itemKey: `customer:${user.id}`,
        eventVersion: user.updatedAt.toISOString(),
      })),
  );

  const summary = {
    total: rows.length,
    vip: rows.filter((u) => u.crmStatus === "VIP").length,
    risk: rows.filter((u) => u.crmStatus === "RISK" || u.crmStatus === "BLOCKED").length,
    revenue: rows.reduce((sum, u) => sum + u.spent, 0),
  };

  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>CRM</span><h1>Клиенти и отношения</h1><p>Пълно клиентско досие, стойност, статуси, тагове и история.</p></div></div>
    <section className={styles.crmSummary}><article><span>Намерени клиенти</span><strong>{summary.total}</strong></article><article><span>VIP</span><strong>{summary.vip}</strong></article><article><span>Рискови / блокирани</span><strong>{summary.risk}</strong></article><article><span>Оборот от резултата</span><strong>{summary.revenue.toFixed(2)} €</strong></article></section>
    <form className={styles.filters}>
      <input name="q" defaultValue={q} placeholder="Име, имейл, телефон, град или таг" />
      <select name="status" defaultValue={status}><option value="all">Всички CRM статуси</option><option value="NEW">Нови</option><option value="ACTIVE">Активни</option><option value="VIP">VIP</option><option value="RISK">Рискови</option><option value="INACTIVE">Неактивни</option><option value="BLOCKED">Блокирани</option></select>
      <select name="sort" defaultValue={sort}><option value="newest">Най-нови</option><option value="oldest">Най-стари</option><option value="name">По име</option><option value="spent">Най-голям оборот</option><option value="profit">Най-голяма печалба</option><option value="orders">Най-много поръчки</option></select>
      <button type="submit">Филтрирай</button><Link href="/admin/customers">Изчисти</Link>
    </form>
    <section className={styles.tableCard}>
      <div className={styles.tableHeader}><span>Клиент</span><span>CRM профил</span><span>Поръчки</span><span>Оборот / печалба</span><span>Последна поръчка</span><span>Статус</span></div>
      {rows.length ? rows.map((user) => {
        const isUnread = unreadCustomerKeys.has(`customer:${user.id}`);
        return <Link href={`/admin/customers/${user.id}`} className={`${styles.row} ${isUnread ? styles.unreadRow : ""}`} key={user.id}>
        <div className={styles.customer}><b>{user.name.charAt(0).toUpperCase()}</b><span><strong>{user.name}{isUnread ? <em className={styles.newPill}>Ново</em> : null}</strong><small>{user.email} · {user.phone || "без телефон"}</small></span></div>
        <div><strong>{crmLabel[user.crmStatus]}</strong><small>{user.crmTagAssignments.slice(0,3).map((x) => x.tag.name).join(" · ") || "Без тагове"}</small></div>
        <strong>{user.orderCount}</strong><div><strong>{user.spent.toFixed(2)} €</strong><small>Печалба {user.profit.toFixed(2)} €</small></div><span>{user.lastOrderAt ? user.lastOrderAt.toLocaleDateString("bg-BG") : "—"}</span><em data-active={user.isActive}>{crmLabel[user.crmStatus]}</em>
      </Link>;
      }) : <div className={styles.empty}>Няма клиенти по зададените критерии.</div>}
    </section>
  </main>;
}
