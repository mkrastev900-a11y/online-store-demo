import assert from "node:assert/strict";
import test from "node:test";
import { publicCheckoutError } from "../lib/checkout-error";

test("checkout never exposes Prisma validation internals or local file paths", () => {
  const error = new Error("Invalid `tx.order.create()` invocation in C:\\Users\\Developer\\shop\\server.js\nUnknown argument `courierProvider`.");
  const message = publicCheckoutError(error);
  assert.equal(message, "Системата за поръчки се обновява. Моля, опитай отново след малко.");
  assert.doesNotMatch(message, /Prisma|C:\\|courierProvider/);
});

test("checkout keeps short business validation messages", () => {
  assert.equal(publicCheckoutError(new Error("Количката е празна.")), "Количката е празна.");
  assert.equal(publicCheckoutError(new Error("Резервацията е изтекла.")), "Резервацията е изтекла.");
});
