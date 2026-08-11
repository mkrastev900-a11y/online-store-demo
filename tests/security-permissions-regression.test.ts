import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test("all admin mutation APIs have server auth and same-origin guard", () => {
  for (const path of walk("app/api/admin").filter((p) => p.endsWith("route.ts"))) {
    const source = readFileSync(path, "utf8");
    if (!/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(source)) continue;
    assert.match(source, /(requireAdminApi|requireSuperAdminApi|requireAdminPermissionApi|requireAnyAdminPermissionApi|getAdminUser)/, `${path}: missing admin auth`);
    assert.match(source, /isSameOriginRequest/, `${path}: missing same-origin guard`);
  }
});

test("same-origin helper rejects requests with no browser metadata in production", () => {
  const source = readFileSync("lib/request-security.ts", "utf8");
  assert.match(source, /return process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /sec-fetch-site/);
  assert.match(source, /referer/);
});

test("direct catalog and support screens enforce their declared view permissions", () => {
  for (const path of [
    "app/admin/catalog-categories/page.tsx",
    "app/admin/product-attributes/page.tsx",
    "app/admin/sizes/page.tsx",
  ]) {
    assert.match(readFileSync(path, "utf8"), /requireAdminPermission\("PRODUCTS:VIEW"\)/, `${path}: missing PRODUCTS:VIEW guard`);
  }
  assert.match(readFileSync("app/admin/support/page.tsx", "utf8"), /requireAdminPermission\("ORDERS:VIEW"\)/);
  const supportApi = readFileSync("app/api/admin/support/[id]/route.ts", "utf8");
  assert.equal(supportApi.match(/requireAdminPermissionApi\("ORDERS:VIEW"\)/g)?.length, 2);
  assert.match(supportApi, /action==="rma"[\s\S]*requireAdminPermissionApi\("ORDERS:REFUND"\)/, "RMA mutations must require ORDERS:REFUND in addition to support view access");
  assert.match(readFileSync("app/api/admin/size-guides/route.ts", "utf8"), /PATCH[\s\S]*requireAdminPermissionApi\("PRODUCTS:EDIT"\)/);
});

test("order reservation cleanup happens only after customer ownership is established", () => {
  for (const path of [
    "app/api/orders/[id]/payment-status/route.ts",
    "app/api/payments/epay/start/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.indexOf("userId: session.userId") < source.indexOf("await releaseExpiredReservations"), `${path}: cleanup runs before ownership check`);
  }
});
