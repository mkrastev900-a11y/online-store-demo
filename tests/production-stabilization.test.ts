import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_NAV_GROUPS } from "../lib/admin-navigation";

test("every admin navigation destination has a granular view permission", () => {
  for (const item of ADMIN_NAV_GROUPS.flatMap((group) => group.items)) {
    assert.ok(item.permission || item.alwaysVisible, `${item.href} must declare a permission or be explicitly admin-only alwaysVisible`);
  }
});


test("super-admin bootstrap is explicit and contains no privileged email allow-list", () => {
  const adminSource = readFileSync(new URL("../lib/admin.ts", import.meta.url), "utf8");
  const bootstrapSource = readFileSync(new URL("../scripts/setup-super-admins.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(adminSource, /PRIMARY_SUPER_ADMIN_EMAILS|gmail\.com/i);
  assert.match(bootstrapSource, /BOOTSTRAP_SUPER_ADMIN_EMAILS/);
  assert.doesNotMatch(bootstrapSource, /gmail\.com/i);
});

test("concurrency-sensitive writes use atomic claims or row locks", () => {
  const resetPassword = readFileSync("app/api/auth/reset-password/route.ts", "utf8");
  const shipment = readFileSync("app/api/admin/orders/[id]/shipment/route.ts", "utf8");
  const customerReply = readFileSync("app/api/contact/[id]/route.ts", "utf8");
  const inventory = readFileSync("lib/inventory.ts", "utf8");
  const orders = readFileSync("lib/orders.ts", "utf8");

  assert.match(resetPassword, /passwordResetToken\.updateMany[\s\S]*usedAt:\s*null[\s\S]*claimed\.count !== 1/);
  assert.doesNotMatch(shipment, /FOR UPDATE/);
  assert.doesNotMatch(customerReply, /FOR UPDATE/);
  assert.doesNotMatch(inventory, /FOR UPDATE/);
  assert.match(orders, /updateOrderStatusWithResult[\s\S]*changed:\s*false/);
  assert.match(orders, /applyPaidCardNotificationWithResult[\s\S]*shouldSendConfirmationEmail/);
});


test("marketing integrations persist in Neon instead of the server filesystem", () => {
  const source = readFileSync("lib/marketing-integrations.ts", "utf8");
  assert.match(source, /prisma\.marketingIntegrationSettings\.(findUnique|upsert)/);
  assert.doesNotMatch(source, /writeFileSync|readFileSync|process\.cwd\(\).*marketing-integrations\.json/);
  const migration = readFileSync("prisma/migrations/20260810103500_marketing_integrations_neon/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "MarketingIntegrationSettings"/);
  assert.match(migration, /MarketingIntegrationSettings_singleton_check/);
});
