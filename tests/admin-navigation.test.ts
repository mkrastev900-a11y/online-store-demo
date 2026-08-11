import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_NAV_GROUPS, findActiveAdminNavHref, findAdminNavGroupId, getVisibleAdminNavGroups } from "@/lib/admin-navigation";

test("admin navigation contains store-only groups", () => {
  assert.deepEqual(ADMIN_NAV_GROUPS.map((group) => group.id), ["overview", "store", "marketing", "customer-service", "accounting", "design", "system", "help"]);
  assert.equal(ADMIN_NAV_GROUPS.some((group) => group.items.some((item) => item.href.startsWith("/admin/erp"))), false);
});

test("inventory remains part of store navigation", () => {
  const groups = getVisibleAdminNavGroups({ isSuperAdmin: true, permissions: [], isDesignOwner: true });
  const active = findActiveAdminNavHref(groups, "/admin/inventory");
  assert.equal(active, "/admin/inventory");
  assert.equal(findAdminNavGroupId(groups, active), "store");
});
