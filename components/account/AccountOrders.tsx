import Image from "next/image";
import Link from "next/link";
import type { CustomerOrder } from "@/lib/customer-orders";
import ContactEmailLink from "@/components/ContactEmailLink";
import { formatPrice } from "@/lib/currency";
import {
  getCourierTrackingPortal,
  getLastActiveOrderStatus,
  getOrderTrackingSteps,
  isDemoShipment,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_MESSAGES,
  type PublicOrderStatus,
} from "@/lib/order-tracking";
import OrderStatusRefresh from "./OrderStatusRefresh";
import ShipmentLiveTracking from "./ShipmentLiveTracking";
import styles from "./AccountOrders.module.css";

const statusClasses: Record<PublicOrderStatus, string> = {
  PENDING: styles.statusPending,
  CONFIRMED: styles.statusConfirmed,
  SHIPPED: styles.statusShipped,
  DELIVERED: styles.statusDelivered,
  CANCELLED: styles.statusCancelled,
};

const paymentLabels: Record<string, string> = {
  PAYMENT_ON_DELIVERY: "Плащане при получаване",
  AWAITING_PAYMENT: "Очаква онлайн плащане",
  PAID: "Платена",
  PAID_REVIEW_REQUIRED: "Платена — проверява се",
  DENIED: "Плащането е отказано",
  EXPIRED: "Плащането е изтекло",
  CANCELLED: "Плащането е отказано",
  PENDING: "Очаква плащане",
};

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(value);
}

function courierLabel(provider: string | null) {
  if (provider === "ECONT") return "Еконт";
  if (provider === "SPEEDY") return "Спиди";
  return "Куриер";
}

export default function AccountOrders({ orders }: { orders: CustomerOrder[] }) {
  const hasActiveOrders = orders.some((order) => !["DELIVERED", "CANCELLED"].includes(order.status));

  return (
    <section className={styles.section} id="orders">
      <div className={styles.sectionHeader}>
        <div>
          <span>ИСТОРИЯ И ПРОСЛЕДЯВАНЕ</span>
          <h2>Моите поръчки</h2>
          <p>Виж артикулите, плащането, доставката и текущия етап на всяка поръчка.</p>
        </div>
        {orders.length > 0 && <OrderStatusRefresh hasActiveOrders={hasActiveOrders} />}
      </div>

      {orders.length === 0 ? (
        <div className={styles.empty}>
          <div aria-hidden="true">◇</div>
          <h3>Все още нямаш поръчки</h3>
          <p>Когато направиш поръчка, тук ще виждаш статуса и цялата ѝ информация.</p>
          <Link href="/new">Разгледай новите предложения</Link>
        </div>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => {
            const displayStatus = order.status as PublicOrderStatus;
            const lastActiveStatus = getLastActiveOrderStatus(displayStatus, order);
            const steps = getOrderTrackingSteps(lastActiveStatus);
            const stepDates = [order.createdAt, order.confirmedAt, order.shippedAt, order.deliveredAt];
            const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const trackingPortal = getCourierTrackingPortal(order.courierProvider);
            const demoShipment = isDemoShipment(order.shipmentNumber);
            const deliveryName = order.deliveryMethod === "OFFICE"
              ? `До ${order.courierOfficeName || "офис"}`
              : "До адрес";
            const deliveryAddress = order.courierOfficeAddress || `${order.address}, ${order.postalCode} ${order.city}`;

            return (
              <article key={order.id} className={styles.orderCard}>
                <header className={styles.orderHeader}>
                  <div>
                    <span className={styles.orderNumber}>НАПРАВЕНА НА</span>
                    <h3>{formatDate(order.createdAt)}</h3>
                  </div>
                  <div className={styles.orderHeadlineMeta}>
                    <span className={`${styles.statusBadge} ${statusClasses[displayStatus]}`}>
                      {ORDER_STATUS_LABELS[displayStatus]}
                    </span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                </header>

                <div className={`${styles.trackingPanel} ${displayStatus === "CANCELLED" ? styles.trackingCancelled : ""}`}>
                  <div className={styles.trackingMessage}>
                    <strong>{ORDER_STATUS_MESSAGES[displayStatus]}</strong>
                    {displayStatus === "CANCELLED" && order.cancelledAt && (
                      <small>Отказана на {formatDate(order.cancelledAt)}</small>
                    )}
                  </div>

                  <ol className={styles.tracker} aria-label="Статус на поръчката">
                    {steps.map((step, index) => (
                      <li key={step.status} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
                        <span className={styles.stepMarker} aria-hidden="true">
                          {step.state === "completed" ? "✓" : index + 1}
                        </span>
                        <div>
                          <strong>{step.label}</strong>
                          <span>{step.description}</span>
                          {stepDates[index] && <small>{formatDate(stepDates[index])}</small>}
                        </div>
                      </li>
                    ))}
                  </ol>

                  {order.shipmentNumber && (
                    <>
                      <div className={styles.shipmentBox}>
                        <div>
                          <span>{demoShipment ? "ТЕСТОВА ТОВАРИТЕЛНИЦА" : "НОМЕР ЗА ПРОСЛЕДЯВАНЕ"}</span>
                          <strong>{order.shipmentNumber}</strong>
                          <small>{courierLabel(order.courierProvider)}</small>
                        </div>
                      </div>
                      {trackingPortal && (order.courierProvider === "ECONT" || order.courierProvider === "SPEEDY") && (
                        <ShipmentLiveTracking
                          orderId={order.id}
                          provider={order.courierProvider}
                          shipmentNumber={order.shipmentNumber}
                          initialStatus={order.shipmentStatus}
                          initialLastTrackedAt={order.shipmentLastTrackedAt?.toISOString() || null}
                          officialTrackingUrl={trackingPortal.url}
                        />
                      )}
                    </>
                  )}
                </div>

                <details className={styles.details}>
                  <summary>Виж артикули и доставка <span aria-hidden="true">⌄</span></summary>
                  <div className={styles.detailsGrid}>
                    <section>
                      <h4>Артикули</h4>
                      <div className={styles.items}>
                        {order.items.map((item) => (
                          <div key={item.id} className={styles.item}>
                            <Link href={`/products/${item.product.slug}`} className={styles.itemImage}>
                              <Image
                                src={item.product.imageUrl}
                                alt={item.name}
                                width={96}
                                height={120}
                                sizes="72px"
                              />
                            </Link>
                            <div>
                              <Link href={`/products/${item.product.slug}`}>{item.name}</Link>
                              <span>Размер {item.size} · {item.quantity} бр.</span>
                            </div>
                            <strong>{formatPrice(item.price * item.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={styles.deliveryDetails}>
                      <h4>Доставка и плащане</h4>
                      <dl>
                        <div><dt>Куриер</dt><dd>{courierLabel(order.courierProvider)}</dd></div>
                        <div><dt>Метод</dt><dd>{deliveryName}</dd></div>
                        <div><dt>Адрес</dt><dd>{deliveryAddress}</dd></div>
                        <div><dt>Плащане</dt><dd>{paymentLabels[order.paymentStatus] || (order.paymentMethod === "CARD" ? "Онлайн с карта" : "При получаване")}</dd></div>
                      </dl>
                      <div className={styles.totals}>
                        <p><span>Артикули</span><strong>{formatPrice(subtotal)}</strong></p>
                        {order.promoDiscount > 0 && <p><span>Промокод {order.promoCode}</span><strong>-{formatPrice(order.promoDiscount)}</strong></p>}<p><span>Доставка</span><strong>{order.shippingCost ? formatPrice(order.shippingCost) : "Безплатна"}</strong></p>
                        <p><span>Общо</span><strong>{formatPrice(order.total)}</strong></p>
                      </div>
                    </section>
                  </div>
                </details>
                <div className={styles.supportAction}>
                  <p className={styles.supportEmails}>
                    <span>Въпрос за поръчката: <ContactEmailLink purpose="orders" /></span>
                    <span>Връщане или рекламация: <ContactEmailLink purpose="support" /></span>
                  </p>
                  <Link className={styles.supportPrimary} href={`/contact?topic=ORDER_QUESTION&orderId=${order.id}`}>Отвори разговор за тази поръчка</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
