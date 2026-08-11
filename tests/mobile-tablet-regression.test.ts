import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("customer service has narrow viewport overflow guards", () => {
  const css = readFileSync("components/admin/SupportTicketsPanel.module.css", "utf8");
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /\.messages article\{max-width:100%/);
  assert.match(css, /\.simpleStatusControl label\{width:100%;min-width:0\}/);
});

test("admin mobile header reserves room for fixed navigation toggle", () => {
  const css = readFileSync("app/admin/admin.module.css", "utf8");
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*?\.header\{padding-left:78px/);
});

test("checkout narrow viewport keeps courier content constrained", () => {
  const css = readFileSync("components/checkout/CheckoutClient.module.css", "utf8");
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /grid-template-columns:72px minmax\(0,1fr\)/);
});
