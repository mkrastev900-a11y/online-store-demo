import { prisma } from "@/lib/prisma";
import {
  ACCOUNTING_PERIOD_LABELS,
  getAccountingDateRange,
  type AccountingPeriod,
} from "@/lib/internal-accounting";
import { DEFAULT_STORE_NAME } from "@/lib/brand";

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function splitVatInclusive(amount: number, rate: number) {
  if (!rate) return { taxBase: round(amount), vat: 0 };
  const taxBase = round(amount / (1 + rate / 100));
  const vat = round(amount - taxBase);
  return { taxBase, vat };
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export type OfficialAccountingEvent = {
  key: string;
  type: "SALE" | "REFUND";
  eventDate: Date;
  orderId: number;
  reference: string;
  customerName: string;
  paymentMethod: string;
  vatRegisteredAtSale: boolean;
  vatRate: number;
  amount: number;
  taxBase: number;
  vat: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Наложен платеж",
  CARD: "Карта",
  BANK_TRANSFER: "Банков превод",
};

export async function getOfficialAccountingReport(period: AccountingPeriod) {
  const { start, end } = getAccountingDateRange(period);

  const [legal, paidOrders, refundedRmas] = await Promise.all([
    prisma.legalSettings.findUnique({ where: { id: 1 } }).catch(() => null),
    prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        paidAt: { gte: start, lte: end },
        status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
      },
      orderBy: { paidAt: "asc" },
      select: {
        id: true,
        paidAt: true,
        customerName: true,
        paymentMethod: true,
        total: true,
        vatRegisteredAtSale: true,
        vatRateAtSale: true,
        taxBaseAtSale: true,
        vatAmountAtSale: true,
      },
    }),
    prisma.supportRmaRequest.findMany({
      where: {
        status: "REFUNDED",
        approvedResolution: "REFUND",
        resolvedAt: { gte: start, lte: end },
        refundAmount: { not: null },
      },
      orderBy: { resolvedAt: "asc" },
      select: {
        id: true,
        reference: true,
        resolvedAt: true,
        refundAmount: true,
        order: {
          select: {
            id: true,
            customerName: true,
            paymentMethod: true,
            total: true,
            vatRegisteredAtSale: true,
            vatRateAtSale: true,
            taxBaseAtSale: true,
            vatAmountAtSale: true,
          },
        },
      },
    }),
  ]);

  const currentVatRegistered = Boolean(legal?.isVatRegistered);
  const currentVatRate = currentVatRegistered ? Number(legal?.defaultVatRate ?? 20) : 0;
  const vatNumber = clean(legal?.vatNumber) || clean(process.env.LEGAL_VAT_NUMBER);
  const vatModes = new Set<string>();
  const events: OfficialAccountingEvent[] = [];

  for (const order of paidOrders) {
    if (!order.paidAt) continue;
    const amount = round(Number(order.total));
    const vatRegisteredAtSale = Boolean(order.vatRegisteredAtSale);
    const vatRate = vatRegisteredAtSale ? Number(order.vatRateAtSale || 0) : 0;
    const fallback = splitVatInclusive(amount, vatRate);
    const storedTaxBase = Number(order.taxBaseAtSale);
    const storedVat = Number(order.vatAmountAtSale);
    const taxBase = vatRegisteredAtSale
      ? round(storedTaxBase > 0 ? storedTaxBase : fallback.taxBase)
      : amount;
    const vat = vatRegisteredAtSale
      ? round(storedVat >= 0 && taxBase + storedVat > 0 ? storedVat : fallback.vat)
      : 0;

    vatModes.add(vatRegisteredAtSale ? `VAT:${vatRate}` : "NO_VAT");
    events.push({
      key: `SALE:${order.id}`,
      type: "SALE",
      eventDate: order.paidAt,
      orderId: order.id,
      reference: `Поръчка #${order.id}`,
      customerName: order.customerName,
      paymentMethod: PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
      vatRegisteredAtSale,
      vatRate,
      amount,
      taxBase,
      vat,
    });
  }

  for (const rma of refundedRmas) {
    if (!rma.resolvedAt) continue;
    const order = rma.order;
    const rawAmount = round(Number(rma.refundAmount ?? 0));
    const amount = round(Math.min(Math.max(0, rawAmount), Number(order.total)));
    if (amount <= 0) continue;
    const vatRegisteredAtSale = Boolean(order.vatRegisteredAtSale);
    const vatRate = vatRegisteredAtSale ? Number(order.vatRateAtSale || 0) : 0;
    const split = vatRegisteredAtSale ? splitVatInclusive(amount, vatRate) : { taxBase: amount, vat: 0 };

    vatModes.add(vatRegisteredAtSale ? `VAT:${vatRate}` : "NO_VAT");
    events.push({
      key: `REFUND:${rma.id}`,
      type: "REFUND",
      eventDate: rma.resolvedAt,
      orderId: order.id,
      reference: rma.reference,
      customerName: order.customerName,
      paymentMethod: PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
      vatRegisteredAtSale,
      vatRate,
      amount,
      taxBase: split.taxBase,
      vat: split.vat,
    });
  }

  events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  const sales = events.filter((event) => event.type === "SALE");
  const refunds = events.filter((event) => event.type === "REFUND");
  const grossRevenue = round(sales.reduce((sum, event) => sum + event.amount, 0));
  const refundedAmount = round(refunds.reduce((sum, event) => sum + event.amount, 0));
  const grossTaxBase = round(sales.reduce((sum, event) => sum + event.taxBase, 0));
  const grossVat = round(sales.reduce((sum, event) => sum + event.vat, 0));
  const refundTaxBase = round(refunds.reduce((sum, event) => sum + event.taxBase, 0));
  const refundVat = round(refunds.reduce((sum, event) => sum + event.vat, 0));

  return {
    generatedAt: new Date(),
    start,
    end,
    periodLabel: ACCOUNTING_PERIOD_LABELS[period],
    company: {
      name: clean(legal?.companyName) || process.env.LEGAL_COMPANY_NAME || DEFAULT_STORE_NAME,
      companyId: clean(legal?.companyId) || process.env.LEGAL_COMPANY_ID || "Не е конфигуриран",
      vatNumber,
      address: clean(legal?.registeredAddress) || process.env.LEGAL_COMPANY_ADDRESS || "Не е конфигуриран",
      representative: clean(legal?.representativeName) || process.env.LEGAL_REPRESENTATIVE_NAME || "Не е конфигуриран",
    },
    currentVatRegistered,
    currentVatRate,
    hasMixedVatModes: vatModes.size > 1,
    summary: {
      grossRevenue,
      refundedAmount,
      netRevenue: round(grossRevenue - refundedAmount),
      grossTaxBase,
      grossVat,
      refundTaxBase,
      refundVat,
      netTaxBase: round(grossTaxBase - refundTaxBase),
      netVat: round(grossVat - refundVat),
      saleCount: sales.length,
      refundCount: refunds.length,
    },
    events,
  };
}
