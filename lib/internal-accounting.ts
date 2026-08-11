import { prisma } from "@/lib/prisma";

export const ACCOUNTING_PERIODS = ["day", "week", "month", "6months", "12months"] as const;
export type AccountingPeriod = (typeof ACCOUNTING_PERIODS)[number];

export const ACCOUNTING_PERIOD_LABELS: Record<AccountingPeriod, string> = {
  day: "Днес",
  week: "Последните 7 дни",
  month: "Текущ месец",
  "6months": "Последните 6 месеца",
  "12months": "Последните 12 месеца",
};

export function normalizeAccountingPeriod(value: string | undefined): AccountingPeriod {
  return ACCOUNTING_PERIODS.includes(value as AccountingPeriod)
    ? (value as AccountingPeriod)
    : "month";
}

export function getAccountingDateRange(period: AccountingPeriod, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "6months") {
    start.setMonth(start.getMonth() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setFullYear(start.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getInternalAccountingReport(period: AccountingPeriod) {
  const { start, end } = getAccountingDateRange(period);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        select: {
          id: true,
          name: true,
          size: true,
          sku: true,
          quantity: true,
          price: true,
          unitCost: true,
          totalCost: true,
        },
      },
      supportRmaRequests: {
        where: {
          status: "REFUNDED",
          approvedResolution: "REFUND",
        },
        select: {
          id: true,
          refundAmount: true,
          items: {
            select: {
              restockedQuantity: true,
              orderItem: {
                select: {
                  quantity: true,
                  unitCost: true,
                  totalCost: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let grossRevenue = 0;
  let refundedAmount = 0;
  let netRevenue = 0;
  let shippingRevenue = 0;
  let productRevenue = 0;
  let totalCost = 0;
  let returnedCost = 0;
  let netCost = 0;
  let unitsSold = 0;
  let returnedUnits = 0;

  const dailyMap = new Map<string, { date: string; orders: number; units: number; returnedUnits: number; revenue: number; refunds: number; netRevenue: number; cost: number; profit: number }>();
  const paymentMap = new Map<string, { label: string; orders: number; revenue: number }>();
  const statusMap = new Map<string, { label: string; orders: number; revenue: number }>();

  const orderRows = orders.map((order) => {
    const total = Number(order.total);
    const shipping = Number(order.shippingCost ?? 0);
    const products = round(total - shipping);
    const itemCost = order.items.reduce((sum, item) => {
      if (item.totalCost != null) return sum + Number(item.totalCost);
      if (item.unitCost != null) return sum + Number(item.unitCost) * item.quantity;
      return sum;
    }, 0);
    const storedCost = Number(order.totalCost ?? 0);
    const cost = storedCost > 0 ? storedCost : itemCost;
    const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const orderRefunds = round(order.supportRmaRequests.reduce((sum, request) => sum + Number(request.refundAmount ?? 0), 0));
    const orderReturnedUnits = order.supportRmaRequests.reduce((sum, request) => sum + request.items.reduce((itemSum, item) => itemSum + Math.max(0, item.restockedQuantity), 0), 0);
    const orderReturnedCost = round(order.supportRmaRequests.reduce((sum, request) => sum + request.items.reduce((itemSum, item) => {
      const restored = Math.max(0, item.restockedQuantity);
      if (!restored) return itemSum;
      const unitCost = item.orderItem.unitCost != null
        ? Number(item.orderItem.unitCost)
        : item.orderItem.totalCost != null && item.orderItem.quantity > 0
          ? Number(item.orderItem.totalCost) / item.orderItem.quantity
          : 0;
      return itemSum + unitCost * restored;
    }, 0), 0));
    const orderNetRevenue = round(Math.max(0, total - orderRefunds));
    const orderNetCost = round(Math.max(0, cost - orderReturnedCost));
    const profit = round(orderNetRevenue - orderNetCost);
    const netUnits = Math.max(0, quantity - orderReturnedUnits);

    grossRevenue += total;
    refundedAmount += orderRefunds;
    netRevenue += orderNetRevenue;
    shippingRevenue += shipping;
    productRevenue += products;
    totalCost += cost;
    returnedCost += orderReturnedCost;
    netCost += orderNetCost;
    unitsSold += netUnits;
    returnedUnits += orderReturnedUnits;

    const dateKey = order.createdAt.toISOString().slice(0, 10);
    const daily = dailyMap.get(dateKey) ?? { date: dateKey, orders: 0, units: 0, returnedUnits: 0, revenue: 0, refunds: 0, netRevenue: 0, cost: 0, profit: 0 };
    daily.orders += 1;
    daily.units += netUnits;
    daily.returnedUnits += orderReturnedUnits;
    daily.revenue += total;
    daily.refunds += orderRefunds;
    daily.netRevenue += orderNetRevenue;
    daily.cost += orderNetCost;
    daily.profit += profit;
    dailyMap.set(dateKey, daily);

    const paymentLabels: Record<string, string> = {
      CASH_ON_DELIVERY: "Наложен платеж",
      CARD: "Карта",
      BANK_TRANSFER: "Банков превод",
    };
    const payment = paymentMap.get(order.paymentMethod) ?? {
      label: paymentLabels[order.paymentMethod] ?? order.paymentMethod,
      orders: 0,
      revenue: 0,
    };
    payment.orders += 1;
    payment.revenue += orderNetRevenue;
    paymentMap.set(order.paymentMethod, payment);

    const statusLabels: Record<string, string> = {
      CONFIRMED: "Потвърдена",
      SHIPPED: "Изпратена",
      DELIVERED: "Доставена",
    };
    const status = statusMap.get(order.status) ?? {
      label: statusLabels[order.status] ?? order.status,
      orders: 0,
      revenue: 0,
    };
    status.orders += 1;
    status.revenue += orderNetRevenue;
    statusMap.set(order.status, status);

    return {
      id: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName,
      status: statusLabels[order.status] ?? order.status,
      paymentMethod: paymentLabels[order.paymentMethod] ?? order.paymentMethod,
      paymentStatus: order.paymentStatus,
      vatRegisteredAtSale: order.vatRegisteredAtSale,
      vatRateAtSale: Number(order.vatRateAtSale ?? 0),
      taxBaseAtSale: Number(order.taxBaseAtSale ?? total),
      vatAmountAtSale: Number(order.vatAmountAtSale ?? 0),
      total: round(total),
      refundedAmount: orderRefunds,
      netTotal: orderNetRevenue,
      productRevenue: products,
      shippingRevenue: round(shipping),
      totalCost: round(cost),
      returnedCost: orderReturnedCost,
      netCost: orderNetCost,
      grossProfit: profit,
      units: netUnits,
      returnedUnits: orderReturnedUnits,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: round(Number(item.price)),
        lineRevenue: round(Number(item.price) * item.quantity),
        lineCost: round(item.totalCost != null ? Number(item.totalCost) : item.unitCost != null ? Number(item.unitCost) * item.quantity : 0),
      })),
    };
  });

  const grossProfit = round(netRevenue - netCost);
  const margin = netRevenue > 0 ? round((grossProfit / netRevenue) * 100) : 0;

  return {
    period,
    periodLabel: ACCOUNTING_PERIOD_LABELS[period],
    start,
    end,
    generatedAt: new Date(),
    summary: {
      grossRevenue: round(grossRevenue),
      refundedAmount: round(refundedAmount),
      netRevenue: round(netRevenue),
      productRevenue: round(productRevenue),
      shippingRevenue: round(shippingRevenue),
      totalCost: round(totalCost),
      returnedCost: round(returnedCost),
      netCost: round(netCost),
      grossProfit,
      margin,
      orderCount: orders.length,
      unitsSold,
      returnedUnits,
      averageOrder: orders.length ? round(netRevenue / orders.length) : 0,
    },
    daily: Array.from(dailyMap.values()).map((row) => ({
      ...row,
      revenue: round(row.revenue),
      refunds: round(row.refunds),
      netRevenue: round(row.netRevenue),
      cost: round(row.cost),
      profit: round(row.profit),
    })).reverse(),
    payments: Array.from(paymentMap.values()).map((row) => ({ ...row, revenue: round(row.revenue) })),
    statuses: Array.from(statusMap.values()).map((row) => ({ ...row, revenue: round(row.revenue) })),
    orders: orderRows.reverse(),
  };
}
