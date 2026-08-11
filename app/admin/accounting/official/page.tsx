import OfficialAccountingToolbar from "@/components/admin/OfficialAccountingToolbar";
import AccountingPagination from "@/components/admin/AccountingPagination";
import { normalizeAccountingPeriod } from "@/lib/internal-accounting";
import { getOfficialAccountingReport } from "@/lib/official-accounting";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../accounting.module.css";

export const dynamic = "force-dynamic";
type SearchParams = { period?: string; eventsPage?: string };
type PageProps = { searchParams: Promise<SearchParams> };
const PAGE_SIZE = 10;
const money = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function OfficialAccountingPage({ searchParams }: PageProps) {
  await requireAdminPermission("ACCOUNTING:VIEW");
  const params = await searchParams;
  const period = normalizeAccountingPeriod(params.period);
  const report = await getOfficialAccountingReport(period);
  const pages = Math.max(1, Math.ceil(report.events.length / PAGE_SIZE));
  const eventsPage = Math.min(Math.max(1, Number.parseInt(params.eventsPage || "1",10) || 1), pages);
  const visibleEvents = report.events.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE);
  const rows = (events = report.events) => events.length ? events.map((event) => <tr key={event.key}><td>{dateTime.format(event.eventDate)}</td><td><b>{event.type === "SALE" ? "Продажба" : "Възстановяване"}</b></td><td>{event.reference}</td><td>#{event.orderId}</td><td>{event.customerName}</td><td>{event.paymentMethod}</td><td>{event.vatRegisteredAtSale ? `ДДС ${event.vatRate}%` : "Без ДДС"}</td><td>{event.type === "REFUND" ? "−" : ""}{money.format(event.amount)}</td><td>{event.type === "REFUND" ? "−" : ""}{money.format(event.taxBase)}</td><td>{event.type === "REFUND" ? "−" : ""}{money.format(event.vat)}</td></tr>) : <tr><td colSpan={10}>Няма реализирани продажби или възстановявания за избрания период.</td></tr>;
  return <main className={styles.main}>
    <header className={styles.heading}><div><span>СЧЕТОВОДЕН ЕКСПОРТ</span><h1>Реализирани продажби и възстановявания</h1><p>{date.format(report.start)} – {date.format(report.end)}</p></div><OfficialAccountingToolbar period={period} /></header>
    <section className={styles.reportHeader}><div><b>{report.company.name}</b><span>ЕИК / Булстат: {report.company.companyId}</span></div><div><span>Текущ ЗДДС режим</span><b>{report.currentVatRegistered ? `Регистрирана · ${report.currentVatRate}%` : "Нерегистрирана по ЗДДС"}</b></div><div><span>Генериран</span><b>{dateTime.format(report.generatedAt)}</b></div></section>
    <section className={styles.companyPanel}><div><span>Адрес на регистрация</span><b>{report.company.address}</b></div><div><span>Представляващ</span><b>{report.company.representative}</b></div><div><span>ДДС №</span><b>{report.currentVatRegistered ? report.company.vatNumber : "Не е приложимо"}</b></div></section>
    {report.hasMixedVatModes && <section className={styles.note}>В избрания период има финансови събития от повече от един ДДС режим/ставка. Всеки ред използва режима, запазен в оригиналната поръчка към момента на продажбата.</section>}
    <section className={styles.note}>Продажба влиза в този отчет само когато плащането е реално потвърдено (`paidAt`). Възстановяване влиза в периода, в който RMA е реално маркирана като „Сумата е възстановена“ (`resolvedAt`). Така по-късен refund не променя назад вече приключил отчетен период.</section>
    <section className={styles.summaryGrid}><article><span>Реализирани продажби</span><strong>{money.format(report.summary.grossRevenue)}</strong><small>{report.summary.saleCount} платени продажби</small></article><article><span>Възстановени суми</span><strong>{money.format(report.summary.refundedAmount)}</strong><small>{report.summary.refundCount} финализирани refund-а</small></article><article><span>Нетно за периода</span><strong>{money.format(report.summary.netRevenue)}</strong><small>Продажби минус refund-и в същия период</small></article><article><span>Нетна данъчна основа</span><strong>{money.format(report.summary.netTaxBase)}</strong><small>По snapshot режима на оригиналната продажба</small></article><article><span>Нетен ДДС</span><strong>{money.format(report.summary.netVat)}</strong><small>0 € за събития без начислен ДДС</small></article><article><span>ДДС по възстановявания</span><strong>{money.format(report.summary.refundVat)}</strong><small>Само реално финализирани refund-и</small></article></section>
    <section className={styles.panel}><h2>Хронологичен регистър за периода</h2><div className={styles.screenOnly}><div className={styles.tableWrap}><table className={styles.ordersTable}><thead><tr><th>Дата</th><th>Тип</th><th>Референция</th><th>Поръчка</th><th>Клиент</th><th>Плащане</th><th>ЗДДС режим</th><th>Сума</th><th>Данъчна основа</th><th>ДДС</th></tr></thead><tbody>{rows(visibleEvents)}</tbody></table></div><AccountingPagination path="/admin/accounting/official" page={eventsPage} pages={pages} total={report.events.length} pageSize={PAGE_SIZE} paramName="eventsPage" query={{period,eventsPage:params.eventsPage}}/></div><div className={styles.printOnly}><table className={styles.ordersTable}><thead><tr><th>Дата</th><th>Тип</th><th>Референция</th><th>Поръчка</th><th>Клиент</th><th>Плащане</th><th>ЗДДС режим</th><th>Сума</th><th>Данъчна основа</th><th>ДДС</th></tr></thead><tbody>{rows()}</tbody></table></div></section>
    <footer className={styles.note}>ДДС режимът се задава изрично във фирмените настройки. Всяка поръчка пази исторически snapshot на режима, ставката, данъчната основа и ДДС. Този експорт е помощен регистър за счетоводител и архив; не е фактура, дневник по ЗДДС, декларация и не извършва автоматично подаване към НАП.</footer>
  </main>;
}
