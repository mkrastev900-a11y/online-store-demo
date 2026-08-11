import AccountingToolbar from "@/components/admin/AccountingToolbar";
import AccountingPagination from "@/components/admin/AccountingPagination";
import { getInternalAccountingReport, normalizeAccountingPeriod } from "@/lib/internal-accounting";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getSiteDesign } from "@/lib/site-design";
import styles from "./accounting.module.css";

export const dynamic = "force-dynamic";

type SearchParams = { period?: string; paymentsPage?: string; statusesPage?: string; dailyPage?: string; ordersPage?: string; detailsPage?: string };
type PageProps = { searchParams: Promise<SearchParams> };
const PAGE_SIZE = 10;
const money = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("bg-BG");
const date = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const pageNo = (value: string | undefined, total: number) => Math.min(Math.max(1, Number.parseInt(value || "1", 10) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
const slicePage = <T,>(rows: T[], page: number) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

export default async function AccountingPage({ searchParams }: PageProps) {
  await requireAdminPermission("ACCOUNTING:VIEW");
  const params = await searchParams;
  const period = normalizeAccountingPeriod(params.period);
  const [report, design] = await Promise.all([
    getInternalAccountingReport(period),
    getSiteDesign(),
  ]);
  const paymentsPage = pageNo(params.paymentsPage, report.payments.length);
  const statusesPage = pageNo(params.statusesPage, report.statuses.length);
  const dailyPage = pageNo(params.dailyPage, report.daily.length);
  const ordersPage = pageNo(params.ordersPage, report.orders.length);
  const detailsPage = pageNo(params.detailsPage, report.orders.length);
  const query = { period, paymentsPage: params.paymentsPage, statusesPage: params.statusesPage, dailyPage: params.dailyPage, ordersPage: params.ordersPage, detailsPage: params.detailsPage };
  const pages = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paymentsRows = (rows = report.payments) => rows.length ? rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.orders}</td><td>{money.format(row.revenue)}</td></tr>) : <tr><td colSpan={3}>Няма данни за периода.</td></tr>;
  const statusRows = (rows = report.statuses) => rows.length ? rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.orders}</td><td>{money.format(row.revenue)}</td></tr>) : <tr><td colSpan={3}>Няма данни за периода.</td></tr>;
  const dailyRows = (rows = report.daily) => rows.length ? rows.map((row) => <tr key={row.date}><td>{date.format(new Date(`${row.date}T12:00:00`))}</td><td>{row.orders}</td><td>{row.units}</td><td>{row.returnedUnits}</td><td>{money.format(row.revenue)}</td><td>{money.format(row.refunds)}</td><td>{money.format(row.netRevenue)}</td><td>{money.format(row.cost)}</td><td>{money.format(row.profit)}</td></tr>) : <tr><td colSpan={9}>Няма отчетени приходи за избрания период.</td></tr>;
  const orderRows = (rows = report.orders) => rows.length ? rows.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{dateTime.format(order.createdAt)}</td><td>{order.customerName}</td><td>{order.status}</td><td>{order.paymentMethod}</td><td>{order.units}</td><td>{order.returnedUnits}</td><td>{money.format(order.total)}</td><td>{money.format(order.refundedAmount)}</td><td><b>{money.format(order.netTotal)}</b></td><td>{money.format(order.netCost)}</td><td>{money.format(order.grossProfit)}</td></tr>) : <tr><td colSpan={12}>Няма поръчки за избрания период.</td></tr>;
  const detailSections = (rows = report.orders) => rows.map((order) => <section className={styles.orderDetail} key={`detail-${order.id}`}><h3>Поръчка #{order.id} · {order.customerName}</h3><table><thead><tr><th>Артикул</th><th>SKU</th><th>Размер</th><th>Количество</th><th>Ед. цена</th><th>Приход</th><th>Себестойност</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.sku || "—"}</td><td>{item.size}</td><td>{item.quantity}</td><td>{money.format(item.unitPrice)}</td><td>{money.format(item.lineRevenue)}</td><td>{money.format(item.lineCost)}</td></tr>)}</tbody></table></section>);

  return <main className={styles.main}>
    <header className={styles.heading}><div><span>ВЪТРЕШНО СЧЕТОВОДСТВО</span><h1>Приходи и калкулация</h1><p>{date.format(report.start)} – {date.format(report.end)}</p></div><AccountingToolbar period={period} /></header>
    <section className={styles.reportHeader}><div><b>{design.brandName}</b><span>Вътрешен управленски отчет</span></div><div><span>Период</span><b>{report.periodLabel}</b></div><div><span>Генериран</span><b>{dateTime.format(report.generatedAt)}</b></div></section>
    <section className={styles.summaryGrid}><article><span>Продажби</span><strong>{money.format(report.summary.grossRevenue)}</strong><small>Преди възстановявания</small></article><article><span>Възстановени суми</span><strong>{money.format(report.summary.refundedAmount)}</strong><small>Само реално маркирани като възстановени</small></article><article><span>Нетни приходи</span><strong>{money.format(report.summary.netRevenue)}</strong><small>Продажби минус възстановявания</small></article><article><span>Приходи от продукти</span><strong>{money.format(report.summary.productRevenue)}</strong><small>Продажби на продукти преди възстановявания</small></article><article><span>Приходи от доставка</span><strong>{money.format(report.summary.shippingRevenue)}</strong><small>Начислена доставка</small></article><article><span>Нетна себестойност</span><strong>{money.format(report.summary.netCost)}</strong><small>След физически върнатите в наличност бройки</small></article><article><span>Брутна печалба</span><strong>{money.format(report.summary.grossProfit)}</strong><small>Нетни приходи минус нетна себестойност</small></article><article><span>Марж</span><strong>{report.summary.margin.toFixed(2)}%</strong><small>Брутна печалба / приходи</small></article><article><span>Поръчки</span><strong>{number.format(report.summary.orderCount)}</strong><small>Потвърдени, изпратени и доставени</small></article><article><span>Нетно продадени артикули</span><strong>{number.format(report.summary.unitsSold)}</strong><small>Продадени минус физически върнати</small></article><article><span>Върнати артикули</span><strong>{number.format(report.summary.returnedUnits)}</strong><small>Реално върнати в наличност</small></article><article><span>Средна поръчка</span><strong>{money.format(report.summary.averageOrder)}</strong><small>Приходи / брой поръчки</small></article></section>
    <section className={styles.twoColumns}>
      <article className={styles.panel}><h2>По начин на плащане</h2><div className={styles.screenOnly}><table><thead><tr><th>Метод</th><th>Поръчки</th><th>Приход</th></tr></thead><tbody>{paymentsRows(slicePage(report.payments,paymentsPage))}</tbody></table><AccountingPagination path="/admin/accounting" page={paymentsPage} pages={pages(report.payments.length)} total={report.payments.length} pageSize={PAGE_SIZE} paramName="paymentsPage" query={query}/></div><div className={styles.printOnly}><table><thead><tr><th>Метод</th><th>Поръчки</th><th>Приход</th></tr></thead><tbody>{paymentsRows()}</tbody></table></div></article>
      <article className={styles.panel}><h2>По статус</h2><div className={styles.screenOnly}><table><thead><tr><th>Статус</th><th>Поръчки</th><th>Приход</th></tr></thead><tbody>{statusRows(slicePage(report.statuses,statusesPage))}</tbody></table><AccountingPagination path="/admin/accounting" page={statusesPage} pages={pages(report.statuses.length)} total={report.statuses.length} pageSize={PAGE_SIZE} paramName="statusesPage" query={query}/></div><div className={styles.printOnly}><table><thead><tr><th>Статус</th><th>Поръчки</th><th>Приход</th></tr></thead><tbody>{statusRows()}</tbody></table></div></article>
    </section>
    <section className={styles.panel}><h2>Дневна разбивка</h2><div className={styles.screenOnly}><div className={styles.tableWrap}><table><thead><tr><th>Дата</th><th>Поръчки</th><th>Нетни артикули</th><th>Върнати</th><th>Продажби</th><th>Възстановени</th><th>Нетни приходи</th><th>Нетна себестойност</th><th>Печалба</th></tr></thead><tbody>{dailyRows(slicePage(report.daily,dailyPage))}</tbody></table></div><AccountingPagination path="/admin/accounting" page={dailyPage} pages={pages(report.daily.length)} total={report.daily.length} pageSize={PAGE_SIZE} paramName="dailyPage" query={query}/></div><div className={styles.printOnly}><table><thead><tr><th>Дата</th><th>Поръчки</th><th>Нетни артикули</th><th>Върнати</th><th>Продажби</th><th>Възстановени</th><th>Нетни приходи</th><th>Нетна себестойност</th><th>Печалба</th></tr></thead><tbody>{dailyRows()}</tbody></table></div></section>
    <section className={styles.panel}><h2>Пълна разбивка по поръчки</h2><div className={styles.screenOnly}><div className={styles.tableWrap}><table className={styles.ordersTable}><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th>Плащане</th><th>Нетни бройки</th><th>Върнати</th><th>Продажба</th><th>Възстановено</th><th>Нетен приход</th><th>Нетна себестойност</th><th>Печалба</th></tr></thead><tbody>{orderRows(slicePage(report.orders,ordersPage))}</tbody></table></div><AccountingPagination path="/admin/accounting" page={ordersPage} pages={pages(report.orders.length)} total={report.orders.length} pageSize={PAGE_SIZE} paramName="ordersPage" query={query}/></div><div className={styles.printOnly}><table className={styles.ordersTable}><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Статус</th><th>Плащане</th><th>Нетни бройки</th><th>Върнати</th><th>Продажба</th><th>Възстановено</th><th>Нетен приход</th><th>Нетна себестойност</th><th>Печалба</th></tr></thead><tbody>{orderRows()}</tbody></table></div></section>
    <div className={styles.screenOnly}>{detailSections(slicePage(report.orders,detailsPage))}<AccountingPagination path="/admin/accounting" page={detailsPage} pages={pages(report.orders.length)} total={report.orders.length} pageSize={PAGE_SIZE} paramName="detailsPage" query={query}/></div><div className={styles.printOnly}>{detailSections()}</div>
    <footer className={styles.note}>Вътрешен управленски отчет. Включени са само поръчки със статус „Потвърдена“, „Изпратена“ или „Доставена“. Реално възстановените суми по RMA се приспадат от приходите, а физически върнатите в наличност бройки намаляват себестойността и нетно продаденото количество. Анулираните и чакащите поръчки не се включват.</footer>
  </main>;
}
