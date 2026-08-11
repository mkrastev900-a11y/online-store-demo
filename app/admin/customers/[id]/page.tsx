import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { hasAdminPermission } from "@/lib/admin-permissions";
import CustomerCrmPanel from "@/components/admin/CustomerCrmPanel";
import AdminAlertItemSeen from "@/components/admin/AdminAlertItemSeen";
import styles from "./customer.module.css";

export const dynamic = "force-dynamic";
const statusLabel: Record<string,string> = { PENDING:"Нова", CONFIRMED:"Потвърдена", SHIPPED:"Изпратена", DELIVERED:"Доставена", CANCELLED:"Отказана" };
const crmLabel: Record<string,string> = { NEW:"Нов клиент", ACTIVE:"Активен", VIP:"VIP", RISK:"Рисков", INACTIVE:"Неактивен", BLOCKED:"Блокиран" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id: Number(id) }, include: {
    orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
    favorites: { orderBy: { createdAt: "desc" }, include: { product: { select: { id:true,name:true,imageUrl:true,price:true } } } },
    productViews: { orderBy: { viewedAt: "desc" }, take: 12, include: { product: { select: { id:true,name:true,imageUrl:true } } } },
    crmNotes: { orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { name:true,email:true } } } },
    crmTagAssignments: { include: { tag: true }, orderBy: { createdAt: "asc" } },
  }});
  if (!user || user.role !== "CUSTOMER") notFound();

  const [canEdit, canStatus, canNotes, canTags, canBlock] = await Promise.all([
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:EDIT"),
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:STATUS"),
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:NOTES"),
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:TAGS"),
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:BLOCK"),
  ]);

  const spent = user.orders.reduce((sum, order) => sum + Number(order.total), 0);
  const profit = user.orders.reduce<number>((sum: number, order: { grossProfit: unknown }) => sum + Number(order.grossProfit), 0);
  const paid = user.orders.reduce((sum, order) => order.paymentStatus === "PAID" ? sum + Number(order.total) : sum, 0);
  const average = user.orders.length ? spent / user.orders.length : 0;
  const bought = new Map<string, { name:string; quantity:number; total:number }>();
  user.orders.flatMap((order) => order.items).forEach((item) => { const current = bought.get(item.name) ?? { name:item.name, quantity:0, total:0 }; current.quantity += item.quantity; current.total += Number(item.price) * item.quantity; bought.set(item.name,current); });

  return <main className={styles.main}>
    {user.crmStatus === "NEW" && user.isActive ? <AdminAlertItemSeen href="/admin/customers" itemKey={`customer:${user.id}`} eventVersion={user.updatedAt.toISOString()} /> : null}
    <div className={styles.hero}><div className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div><div><span>CRM ДОСИЕ #{user.id}</span><h1>{user.name}</h1><p>{user.email} · {user.phone || "без телефон"}</p><div className={styles.heroTags}>{user.crmTagAssignments.map(({tag}: { tag: { id: number; name: string } }) => <b key={tag.id}>{tag.name}</b>)}</div></div><em data-active={user.isActive}>{crmLabel[user.crmStatus]}</em></div>
    <div className={styles.stats}><article><span>Поръчки</span><strong>{user.orders.length}</strong></article><article><span>Общ оборот</span><strong>{spent.toFixed(2)} €</strong></article><article><span>Брутна печалба</span><strong>{profit.toFixed(2)} €</strong></article><article><span>Средна поръчка</span><strong>{average.toFixed(2)} €</strong></article><article><span>Регистрирани плащания</span><strong>{paid.toFixed(2)} €</strong></article></div>
    <div className={styles.grid}>
      <section className={styles.card}><span>ЛИЧНА ИНФОРМАЦИЯ</span><h2>Контакти и адрес</h2><dl><dt>Име</dt><dd>{user.name}</dd><dt>Имейл</dt><dd>{user.email}</dd><dt>Телефон</dt><dd>{user.phone || "—"}</dd><dt>Адрес</dt><dd>{[user.address,user.addressLine2,user.city,user.postalCode,user.country].filter(Boolean).join(", ") || "—"}</dd><dt>Последен вход</dt><dd>{user.lastLoginAt ? user.lastLoginAt.toLocaleString("bg-BG") : "Няма запис"}</dd><dt>Регистрация</dt><dd>{user.createdAt.toLocaleString("bg-BG")}</dd></dl></section>
      <CustomerCrmPanel userId={user.id} isActive={user.isActive} crmStatus={user.crmStatus} adminNote={user.adminNote || ""} notes={user.crmNotes.map((n: typeof user.crmNotes[number]) => ({...n, createdAt:n.createdAt.toISOString()}))} tags={user.crmTagAssignments.map((x: typeof user.crmTagAssignments[number]) => x.tag)} permissions={{ edit:canEdit, status:canStatus, notes:canNotes, tags:canTags, block:canBlock }} />
      <section className={`${styles.card} ${styles.wide}`}><span>ИСТОРИЯ</span><h2>Поръчки и плащания</h2>{user.orders.length ? <div className={styles.orders}>{user.orders.map((order: typeof user.orders[number]) => <div key={order.id}><b>#{order.id}</b><span>{order.createdAt.toLocaleDateString("bg-BG")}</span><span>{statusLabel[order.status]}</span><span>{order.paymentStatus === "PAID" ? `${Number(order.total).toFixed(2)} € платени` : "Неплатена"}</span><strong>{Number(order.total).toFixed(2)} €</strong></div>)}</div> : <p>Клиентът няма поръчки.</p>}</section>
      <section className={styles.card}><span>ПОКУПКИ</span><h2>Купени продукти</h2>{bought.size ? <div className={styles.list}>{Array.from(bought.values()).slice(0,12).map((item) => <div key={item.name}><span>{item.name}<small>{item.quantity} бр.</small></span><strong>{item.total.toFixed(2)} €</strong></div>)}</div> : <p>Няма закупени продукти.</p>}</section>
      <section className={styles.card}><span>ИНТЕРЕС</span><h2>Любими и разглеждани</h2><div className={styles.list}>{user.favorites.slice(0,6).map((f: typeof user.favorites[number]) => <div key={f.id}><span>❤ {f.product.name}</span><strong>{Number(f.product.price).toFixed(2)} €</strong></div>)}{user.productViews.slice(0,6).map((v: typeof user.productViews[number]) => <div key={v.id}><span>◌ {v.product.name}</span><small>{v.viewCount} преглеждания</small></div>)}{!user.favorites.length && !user.productViews.length && <p>Все още няма активност.</p>}</div></section>
    </div>
  </main>;
}
