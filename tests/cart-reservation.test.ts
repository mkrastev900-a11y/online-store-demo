import assert from "node:assert/strict";
import test from "node:test";
import { planCheckoutReservations } from "../lib/cart-reservation";

test("checkout automatically renews every still available cart item", () => {
  const plan = planCheckoutReservations([
    { cartItemId: 1, variantId: 10, requestedQuantity: 2, stock: 5, reservedByOthers: 2, active: true },
    { cartItemId: 2, variantId: 20, requestedQuantity: 1, stock: 1, reservedByOthers: 0, active: true },
  ]);
  assert.deepEqual(plan.renewable.map((item) => item.cartItemId), [1, 2]);
  assert.equal(plan.unavailable.length, 0);
});

test("checkout removes only sold-out or insufficient cart lines", () => {
  const plan = planCheckoutReservations([
    { cartItemId: 1, variantId: 10, requestedQuantity: 1, stock: 1, reservedByOthers: 1, active: true },
    { cartItemId: 2, variantId: 20, requestedQuantity: 3, stock: 4, reservedByOthers: 2, active: true },
    { cartItemId: 3, variantId: 30, requestedQuantity: 1, stock: 8, reservedByOthers: 0, active: true },
  ]);
  assert.deepEqual(plan.unavailable.map((item) => [item.cartItemId, item.availableStock]), [[1, 0], [2, 2]]);
  assert.deepEqual(plan.renewable.map((item) => item.cartItemId), [3]);
});

test("inactive products cannot be renewed even when physical stock exists", () => {
  const plan = planCheckoutReservations([
    { cartItemId: 1, variantId: 10, requestedQuantity: 1, stock: 10, reservedByOthers: 0, active: false },
  ]);
  assert.equal(plan.renewable.length, 0);
  assert.equal(plan.unavailable[0].cartItemId, 1);
});
