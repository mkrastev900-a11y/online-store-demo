import assert from "node:assert/strict";
import test from "node:test";

import { cashFlowTotals, netSettledAmount } from "../lib/payment-math";

test("refunds and reversals reopen the linked settlement balance", () => {
  assert.equal(netSettledAmount([
    { amount: 100, kind: "PAYMENT" },
    { amount: 25, kind: "REFUND" },
    { amount: 10, kind: "REVERSAL" },
  ]), 65);
});

test("cash flow follows the real direction of correction movements", () => {
  const totals = cashFlowTotals([
    { amount: 100, direction: "INCOMING" },
    { amount: 25, direction: "OUTGOING" },
  ]);
  assert.deepEqual(totals, { incoming: 100, outgoing: 25 });
  assert.equal(totals.incoming - totals.outgoing, 75);
});
