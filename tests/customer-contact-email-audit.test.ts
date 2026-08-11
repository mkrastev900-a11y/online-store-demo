import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customerFacingSources = [
  "app/contact/page.tsx",
  "app/about/page.tsx",
  "app/terms/page.tsx",
  "components/Footer.tsx",
  "components/ContactEmailLink.tsx",
  "components/account/AccountOrders.tsx",
  "components/checkout/CheckoutClient.tsx",
  "components/order-success/PaymentResultClient.tsx",
  "lib/site-design.ts",
  "lib/legal-settings.ts",
  "lib/order-payment-document.ts",
  "lib/email.ts",
];

function source(path: string) {
  return readFileSync(path, "utf8");
}

function withoutCompatibilityIdentifiers(value: string) {
  return value
    .replaceAll("zlatevi-open-cookie-settings", "")
    .replaceAll("zlatevi-purchase-tracked:", "");
}

test("customer-facing contact sources contain no previous identity or temporary sender", () => {
  for (const path of customerFacingSources) {
    const text = source(path);
    assert.doesNotMatch(text, /onboarding@resend\.dev/i, `${path} must not expose the Resend onboarding sender`);
    assert.doesNotMatch(withoutCompatibilityIdentifiers(text), /zlatevi|златев|gmail\.com/i, `${path} must not expose the previous identity`);
  }
});

test("public contact config resolves Company Details and EMAIL_* values with safe fallbacks", () => {
  const config = source("lib/contact-config.ts");

  assert.match(config, /process\.env\.EMAIL_REPLY_TO/);
  assert.match(config, /process\.env\.EMAIL_ORDERS/);
  assert.match(config, /process\.env\.EMAIL_SUPPORT/);
  assert.match(config, /office@example\.com/);
  assert.match(config, /orders@example\.com/);
  assert.match(config, /support@example\.com/);
  assert.doesNotMatch(config, /gmail\.com|zlatevi|златев/i);
});

test("contact page presents all three customer-facing contact purposes", () => {
  const contactPage = source("app/contact/page.tsx");

  assert.match(contactPage, /Общи въпроси/);
  assert.match(contactPage, /purpose:\s*"office"/);
  assert.match(contactPage, /Поръчки/);
  assert.match(contactPage, /purpose:\s*"orders"/);
  assert.match(contactPage, /Помощ и рекламации/);
  assert.match(contactPage, /purpose:\s*"support"/);
  assert.match(contactPage, /ContactEmailLink purpose=\{contact\.purpose\}/);
});

test("order and support customer content use the shared contact provider", () => {
  const sources = [
    "components/account/AccountOrders.tsx",
    "components/order-success/PaymentResultClient.tsx",
    "components/checkout/CheckoutClient.tsx",
  ].map(source).join("\n");

  assert.match(sources, /ContactEmailLink purpose="orders"/);
  assert.match(sources, /ContactEmailLink purpose="support"/);
  assert.match(source("lib/order-payment-document.ts"), /resolvePublicContactEmails\(\)\.orders/);
});

test("legal and visual defaults use configuration rather than administrator identity", () => {
  const legal = source("lib/legal-settings.ts");
  const siteDesign = source("lib/site-design.ts");

  assert.doesNotMatch(legal, /ADMIN_EMAIL|gmail\.com/i);
  assert.match(legal, /resolvePublicContactEmails/);
  assert.match(siteDesign, /email:\s*DEFAULT_CONTACT_EMAILS\.office/);
  assert.match(siteDesign, /normalizePublicContactEmail\(value,\s*"office"\)/);
});
