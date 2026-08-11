export type PaymentAmountRow = {
  amount: unknown;
  kind: string;
};

export type CashFlowRow = {
  amount: unknown;
  direction: "INCOMING" | "OUTGOING";
};

export function netSettledAmount(rows: readonly PaymentAmountRow[]) {
  return rows.reduce(
    (sum, row) => sum + (row.kind === "PAYMENT" ? 1 : -1) * Number(row.amount),
    0,
  );
}

export function cashFlowTotals(rows: readonly CashFlowRow[]) {
  return rows.reduce(
    (totals, row) => {
      totals[row.direction === "INCOMING" ? "incoming" : "outgoing"] += Number(row.amount);
      return totals;
    },
    { incoming: 0, outgoing: 0 },
  );
}
