import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("order route does not eagerly load native sharp through email module", () => {
  const email = readFileSync("lib/email.ts", "utf8");
  assert.doesNotMatch(email, /^import .*order-payment-document/m);
  assert.match(email, /await import\("@\/lib\/order-payment-document"\)/);
});

test("payment document generation has no native sharp dependency", () => {
  const source = readFileSync("lib/order-payment-document.ts", "utf8");
  assert.doesNotMatch(source, /from "sharp"/);
  assert.doesNotMatch(source, /require\(["']sharp["']\)/);
  assert.doesNotMatch(source, /sharp\(/);
});

test("size guide persistence uses bulk writes and extended transaction timeout", () => {
  const route = readFileSync("app/api/admin/size-guides/route.ts", "utf8");
  assert.match(route, /createManyAndReturn/);
  assert.match(route, /sizeGuideValue\.createMany/);
  assert.match(route, /timeout: 15_000/);
});

test("sharp TypeScript compatibility declaration is present", () => {
  const source = readFileSync("types/sharp.d.ts", "utf8");
  assert.match(source, /declare module "sharp"/);
  assert.match(source, /toBuffer\(\): Promise<Buffer>/);
});
