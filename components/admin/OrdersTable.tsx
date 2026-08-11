/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAdminNavAlertItemViewed } from "@/lib/admin-nav-alert-client";
import styles from "./OrdersTable.module.css";

type Status = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
type Order = {
  id: number; unread: boolean; status: Status; total: number; shippingCost: number; promoCode: string | null; promoDiscount: number;
  customerName: string; customerEmail: string; customerPhone: string | null;
  address: string; city: string; postalCode: string; country: string;
  deliveryMethod: string; paymentMethod: string; paymentStatus: string; notes: string | null;
  courierProvider: string | null; courierOfficeName: string | null; courierOfficeAddress: string | null;
  shippingQuoteSource: string | null; shipmentNumber: string | null; shipmentLabelUrl: string | null; shipmentStatus: string | null;
  createdAt: Date | string;
  items: Array<{
    id: number; productId: number; slug: string; name: string; description: string | null; imageUrl: string;
    size: string; color: string | null; material: string | null; brand: string | null; productType: string;
    quantity: number; price: number; lineTotal: number; sku: string | null;
  }>;
};

const labels: Record<Status, string> = {
  PENDING: "Нова", CONFIRMED: "Потвърдена", SHIPPED: "Изпратена", DELIVERED: "Доставена", CANCELLED: "Отказана",
};
const paymentLabels: Record<string, string> = {
  PAYMENT_ON_DELIVERY: "плащане при доставка", AWAITING_PAYMENT: "очаква плащане", PAID: "платена",
  PAID_REVIEW_REQUIRED: "платена — нужда от проверка", DENIED: "отказано плащане", EXPIRED: "изтекло плащане", CANCELLED: "отказано",
};
const actions: Record<Status, Array<{ status: Status; label: string }>> = {
  PENDING: [{ status: "CONFIRMED", label: "Потвърди" }, { status: "CANCELLED", label: "Откажи" }],
  CONFIRMED: [{ status: "SHIPPED", label: "Маркирай изпратена" }, { status: "CANCELLED", label: "Откажи и върни наличността" }],
  SHIPPED: [{ status: "DELIVERED", label: "Маркирай доставена" }, { status: "CANCELLED", label: "Откажи и върни наличността" }],
  DELIVERED: [], CANCELLED: [],
};

export default function OrdersTable({ brandName, orders, permissions }: { brandName: string; orders: Order[]; permissions: { canConfirm: boolean; canShip: boolean; canDeliver: boolean; canCancel: boolean } }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  useEffect(() => {
    if (!printOrder) return;

    const previousTitle = document.title;
    document.title = `Поръчка-${printOrder.customerName.replace(/[^a-zA-Z0-9\u0400-\u04FF]+/g, "-")}-${new Date(printOrder.createdAt).toISOString().slice(0, 10)}`;
    const timer = window.setTimeout(() => window.print(), 80);
    const clearPrintedOrder = () => setPrintOrder(null);
    window.addEventListener("afterprint", clearPrintedOrder, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", clearPrintedOrder);
      document.title = previousTitle;
    };
  }, [printOrder]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minTotal === "" ? null : Number(minTotal);
    const max = maxTotal === "" ? null : Number(maxTotal);
    const result = orders.filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (q && !`${o.id} ${o.customerName} ${o.customerEmail} ${o.customerPhone ?? ""} ${o.city} ${o.items.map(i => i.name).join(" ")}`.toLowerCase().includes(q)) return false;
      if (min !== null && Number.isFinite(min) && o.total < min) return false;
      if (max !== null && Number.isFinite(max) && o.total > max) return false;
      return true;
    });
    return result.sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "total-asc") return a.total - b.total;
      if (sort === "total-desc") return b.total - a.total;
      if (sort === "customer") return a.customerName.localeCompare(b.customerName, "bg");
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, orders, query, minTotal, maxTotal, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paginatedOrders = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filter, query, minTotal, maxTotal, sort]);

  async function changeStatus(order: Order, status: Status) {
    const text = status === "CANCELLED" && ["CONFIRMED", "SHIPPED"].includes(order.status)
      ? "Да откажа ли поръчката? Продадената наличност ще бъде върната автоматично."
      : `Да променя ли поръчка #${order.id} на „${labels[status]}“?`;
    if (!confirm(text)) return;
    setBusyId(order.id); setError("");
    const response = await fetch(`/api/admin/orders/${order.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Статусът не беше променен.");
    else router.refresh();
    setBusyId(null);
  }

  async function createShipment(order: Order) {
    if (!confirm(`Да създам ли товарителница за поръчка #${order.id} в ${order.courierProvider === "ECONT" ? "Еконт" : "Спиди"}?`)) return;
    setBusyId(order.id); setError("");
    const response = await fetch(`/api/admin/orders/${order.id}/shipment`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Товарителницата не беше създадена.");
    else router.refresh();
    setBusyId(null);
  }

  function toggleOrder(order: Order) {
    if (openId === order.id) {
      setOpenId(null);
      return;
    }

    setOpenId(order.id);
    if (!order.unread || viewedIds.includes(order.id)) return;
    void markAdminNavAlertItemViewed({
      href: "/admin/orders",
      itemKey: `order:${order.id}`,
      eventVersion: new Date(order.createdAt).toISOString(),
    }).then((newlyViewed) => {
      if (newlyViewed) {
        setViewedIds((current) => [...current, order.id]);
      }
    });
  }

  return <>
    <div className={styles.advancedFilters}>
      <label className={styles.orderSearch}><span>Търсене</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="№, клиент, имейл, телефон, артикул..." /></label>
      <label><span>Мин. сума</span><input type="number" min="0" step="0.01" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} /></label>
      <label><span>Макс. сума</span><input type="number" min="0" step="0.01" value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} /></label>
      <label><span>Сортиране</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Най-нови</option><option value="oldest">Най-стари</option><option value="total-desc">Сума ↓</option><option value="total-asc">Сума ↑</option><option value="customer">Клиент А–Я</option></select></label>
      {(query || minTotal || maxTotal || sort !== "newest") && <button onClick={() => { setQuery(""); setMinTotal(""); setMaxTotal(""); setSort("newest"); setPage(1); }}>Изчисти</button>}
    </div>
    <div className={styles.resultsCount}><strong>{visible.length}</strong> от {orders.length} поръчки</div>
    <div className={styles.filters}>
      {(["ALL", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const).map((status) =>
        <button key={status} className={filter === status ? styles.activeFilter : ""} onClick={() => setFilter(status)}>
          {status === "ALL" ? `Всички (${orders.length})` : `${labels[status]} (${orders.filter((o) => o.status === status).length})`}
        </button>)}
    </div>
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.list}>
      {visible.length === 0 ? <div className={styles.empty}>Няма поръчки с този статус.</div> : paginatedOrders.map((order) => {
        const subtotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
        const unread = order.unread && !viewedIds.includes(order.id);
        const availableActions = actions[order.status].filter((action) => {
          if (action.status === "CONFIRMED") return permissions.canConfirm;
          if (action.status === "SHIPPED") return permissions.canShip;
          if (action.status === "DELIVERED") return permissions.canDeliver;
          if (action.status === "CANCELLED") return permissions.canCancel;
          return false;
        });
        return <article key={order.id} className={`${styles.order} ${styles[`status_${order.status}`]} ${unread ? styles.unreadOrder : ""}`}>
          <button className={styles.heading} onClick={() => toggleOrder(order)}>
            <div><span>Поръчка #{order.id} · {new Date(order.createdAt).toLocaleString("bg-BG")} {unread ? <b className={styles.newPill}>Нова</b> : null}</span><strong>{order.customerName}</strong><small>{order.customerEmail}</small></div>
            <div className={styles.status}><span>{labels[order.status]}</span><strong>{order.total.toFixed(2)} €</strong><small>{openId === order.id ? "Затвори детайлите" : "Виж детайли"}</small></div>
          </button>
          {openId === order.id && <div className={styles.details}>
            <section><h3>Клиент и доставка</h3><p><b>Телефон:</b> {order.customerPhone || "—"}</p><p><b>Куриер:</b> {order.courierProvider === "ECONT" ? "Еконт" : order.courierProvider === "SPEEDY" ? "Спиди" : "—"}</p><p><b>Доставка:</b> {order.deliveryMethod === "OFFICE" ? `До ${order.courierOfficeName || "офис"}` : "До адрес"}</p><p><b>Адрес:</b> {order.courierOfficeAddress || order.address}, {order.postalCode} {order.city}, {order.country}</p><p><b>Плащане:</b> {order.paymentMethod === "CARD" ? "Онлайн с карта" : "При получаване (ППП)"} · {paymentLabels[order.paymentStatus] || order.paymentStatus}</p>{order.shipmentNumber && <p><b>Товарителница:</b> {order.shipmentLabelUrl ? <a href={order.shipmentLabelUrl} target="_blank" rel="noreferrer">{order.shipmentNumber}</a> : order.shipmentNumber} {order.shipmentStatus ? `· ${order.shipmentStatus}` : ""}</p>}{order.shippingQuoteSource === "FALLBACK" && <p><b>Цена за доставка:</b> резервна тарифа — провери преди изпращане</p>}{order.notes && <p><b>Бележка:</b> {order.notes}</p>}</section>
            <section>
              <h3>Артикули</h3>
              <div className={styles.items}>
                {order.items.map((item) => (
                  <article className={styles.itemCard} key={item.id}>
                    <Link className={styles.itemImage} href={`/products/${item.slug}`} target="_blank">
                      <Image src={item.imageUrl} alt={item.name} fill sizes="96px" />
                    </Link>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemTitleRow}>
                        <Link href={`/products/${item.slug}`} target="_blank">{item.name}</Link>
                        <strong>{item.lineTotal.toFixed(2)} €</strong>
                      </div>
                      {item.description ? <p className={styles.itemDescription}>{item.description}</p> : null}
                      <dl className={styles.itemDetails}>
                        <div><dt>Размер</dt><dd>{item.size}</dd></div>
                        {item.color ? <div><dt>Цвят</dt><dd>{item.color}</dd></div> : null}
                        {item.material ? <div><dt>Материал</dt><dd>{item.material}</dd></div> : null}
                        {item.brand ? <div><dt>Марка</dt><dd>{item.brand}</dd></div> : null}
                        {item.sku ? <div><dt>SKU</dt><dd>{item.sku}</dd></div> : null}
                      </dl>
                      <div className={styles.itemPriceRow}>
                        <span>Количество: <b>{item.quantity}</b></span>
                        <span>Единична цена: <b>{item.price.toFixed(2)} €</b></span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className={styles.totals}><p><span>Артикули</span><b>{subtotal.toFixed(2)} €</b></p>{order.promoDiscount > 0 && <p><span>Промокод {order.promoCode}</span><b>-{order.promoDiscount.toFixed(2)} €</b></p>}<p><span>Доставка</span><b>{order.shippingCost ? `${order.shippingCost.toFixed(2)} €` : "Безплатна"}</b></p><p><span>Общо</span><strong>{order.total.toFixed(2)} €</strong></p></div>
            </section>
          </div>}
          <div className={styles.actions}>
            <button className={styles.pdfButton} onClick={() => setPrintOrder(order)}>Изтегли PDF</button>
            {permissions.canShip && order.status === "CONFIRMED" && !order.shipmentNumber && <button disabled={busyId === order.id || !order.courierProvider} onClick={() => createShipment(order)}>{busyId === order.id ? "Свързване..." : "Създай товарителница"}</button>}
            {availableActions.map((action) => <button key={action.status} disabled={busyId === order.id} className={action.status === "CANCELLED" ? styles.danger : ""} onClick={() => changeStatus(order, action.status)}>{busyId === order.id ? "Обработване..." : action.label}</button>)}
          </div>
        </article>;
      })}
    </div>
    <Pagination
      page={currentPage}
      pages={pages}
      total={visible.length}
      pageSize={pageSize}
      onChange={setPage}
    />
    {printOrder ? <OrderPrintDocument brandName={brandName} order={printOrder} /> : null}
  </>;
}

function Pagination({
  page,
  pages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter((value) => {
    if (pages <= 7) return true;
    return value === 1 || value === pages || Math.abs(value - page) <= 1;
  });

  return (
    <nav className={styles.pagination} aria-label="Страници с поръчки">
      <div className={styles.paginationInfo}>Показани {first}–{last} от {total}</div>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Предишна страница"
        >
          ‹
        </button>
        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const showGap = previous !== undefined && pageNumber - previous > 1;
          return (
            <span className={styles.pageGroup} key={pageNumber}>
              {showGap && <span className={styles.pageDots}>…</span>}
              <button
                type="button"
                className={`${styles.pageButton} ${pageNumber === page ? styles.pageButtonActive : ""}`}
                onClick={() => onChange(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          aria-label="Следваща страница"
        >
          ›
        </button>
      </div>
    </nav>
  );
}

function OrderPrintDocument({ brandName, order }: { brandName: string; order: Order }) {
  const subtotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const courier = order.courierProvider === "ECONT" ? "Еконт" : order.courierProvider === "SPEEDY" ? "Спиди" : "—";
  const delivery = order.deliveryMethod === "OFFICE" ? `До ${order.courierOfficeName || "офис"}` : "До адрес";
  const payment = order.paymentMethod === "CARD" ? "Онлайн с карта" : "При получаване (ППП)";

  return <section className={styles.printArea} aria-hidden="true">
    <header className={styles.printHeader}>
      <div><span>{brandName}</span><h1>Данни за поръчка</h1></div>
      <div><b>{labels[order.status]}</b><strong>{order.total.toFixed(2)} €</strong></div>
    </header>
    <p className={styles.printDate}>Създадена на {new Date(order.createdAt).toLocaleString("bg-BG")}</p>

    <div className={styles.printColumns}>
      <section>
        <h2>Клиент</h2>
        <p><b>Име:</b> {order.customerName}</p>
        <p><b>Имейл:</b> {order.customerEmail}</p>
        <p><b>Телефон:</b> {order.customerPhone || "—"}</p>
      </section>
      <section>
        <h2>Доставка и плащане</h2>
        <p><b>Куриер:</b> {courier}</p>
        <p><b>Доставка:</b> {delivery}</p>
        <p><b>Адрес:</b> {order.courierOfficeAddress || order.address}, {order.postalCode} {order.city}, {order.country}</p>
        <p><b>Плащане:</b> {payment} · {paymentLabels[order.paymentStatus] || order.paymentStatus}</p>
        {order.shipmentNumber ? <p><b>Товарителница:</b> {order.shipmentNumber}{order.shipmentStatus ? ` · ${order.shipmentStatus}` : ""}</p> : null}
      </section>
    </div>

    {order.notes ? <div className={styles.printNote}><b>Бележка:</b> {order.notes}</div> : null}

    <h2 className={styles.printItemsTitle}>Артикули</h2>
    <div className={styles.printItems}>
      {order.items.map((item) => <article key={item.id}>
        <img src={item.imageUrl} alt="" />
        <div>
          <h3>{item.name}</h3>
          {item.description ? <p>{item.description}</p> : null}
          <dl>
            <div><dt>Размер</dt><dd>{item.size}</dd></div>
            {item.color ? <div><dt>Цвят</dt><dd>{item.color}</dd></div> : null}
            {item.material ? <div><dt>Материал</dt><dd>{item.material}</dd></div> : null}
            {item.brand ? <div><dt>Марка</dt><dd>{item.brand}</dd></div> : null}
            {item.sku ? <div><dt>SKU</dt><dd>{item.sku}</dd></div> : null}
          </dl>
          <p className={styles.printItemPrice}>Количество: <b>{item.quantity}</b> · Единична цена: <b>{item.price.toFixed(2)} €</b></p>
        </div>
        <strong>{item.lineTotal.toFixed(2)} €</strong>
      </article>)}
    </div>

    <div className={styles.printTotals}>
      <p><span>Артикули</span><b>{subtotal.toFixed(2)} €</b></p>
      {order.promoDiscount > 0 && <p><span>Промокод {order.promoCode}</span><b>-{order.promoDiscount.toFixed(2)} €</b></p>}
      <p><span>Доставка</span><b>{order.shippingCost ? `${order.shippingCost.toFixed(2)} €` : "Безплатна"}</b></p>
      <p><span>Общо</span><strong>{order.total.toFixed(2)} €</strong></p>
    </div>
    <footer>Документът е генериран от административния панел на {brandName}.</footer>
  </section>;
}
