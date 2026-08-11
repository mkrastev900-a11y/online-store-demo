/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-compatible test rows intentionally cover heterogeneous model shapes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

import { cleanupDemoDataInTransaction, calculateStockRestorePlan } from "../lib/demo-data-cleanup-core";
import { hasValidCronSecret } from "../lib/cron-auth";
import { getDemoDataTtlMinutes, isDemoModeEnabled, resolveLoginIdentifier } from "../lib/demo-mode";
import { ensureTestAdmin } from "../scripts/bootstrap-test-admin.mjs";

type Row = Record<string, any>;

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  if (Array.isArray(where.OR) && !where.OR.some((condition: Row) => matchesWhere(row, condition))) return false;

  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR") continue;
    const value = row[key];
    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }
    if (typeof condition === "object" && condition !== null && !Array.isArray(condition)) {
      if ("lt" in condition && !(new Date(value).getTime() < new Date(condition.lt).getTime())) return false;
      if ("in" in condition && !condition.in.includes(value)) return false;
      if ("not" in condition && value === condition.not) return false;
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

function createCleanupDatabase(now: Date) {
  const old = new Date(now.getTime() - 20 * 60_000);
  const fresh = new Date(now.getTime() - 2 * 60_000);
  const state = {
    users: [
      { id: 1, email: "old-customer@example.com", role: "CUSTOMER", createdAt: old },
      { id: 2, email: "admin@example.local", role: "SUPER_ADMIN", createdAt: old },
      { id: 3, email: "new-customer@example.com", role: "CUSTOMER", createdAt: fresh },
    ],
    orders: [
      {
        id: 10,
        userId: 1,
        status: "CONFIRMED",
        createdAt: old,
        items: [{ productId: 100, variantId: 200, quantity: 2, rmaItems: [{ restockedQuantity: 1 }] }],
      },
      {
        id: 11,
        userId: 2,
        status: "PENDING",
        createdAt: old,
        items: [{ productId: 100, variantId: 200, quantity: 1, rmaItems: [] }],
      },
      {
        id: 12,
        userId: 3,
        status: "PENDING",
        createdAt: fresh,
        items: [{ productId: 100, variantId: 200, quantity: 1, rmaItems: [] }],
      },
    ],
    tickets: [
      { id: 20, userId: 1, orderId: 10, createdAt: old },
      { id: 21, userId: 3, orderId: null, createdAt: fresh },
    ],
    attachments: [{ id: 30, ticketId: 20, fileName: "demo.pdf", mimeType: "application/pdf", publicId: "demo/30", resourceType: "raw", size: 10, url: "https://example.com/demo.pdf" }],
    rmaRequests: [{ id: 40, ticketId: 20 }],
    carts: [{ id: 50, userId: 1 }, { id: 51, userId: 2 }, { id: 52, userId: 3 }],
    cartItems: [{ id: 60, cartId: 50, createdAt: old }, { id: 61, cartId: 52, createdAt: fresh }],
    favorites: [{ id: 70, userId: 1, createdAt: old }, { id: 71, userId: 3, createdAt: fresh }],
    productViews: [{ id: 80, userId: 1, viewedAt: old }, { id: 81, userId: 3, viewedAt: fresh }],
    inventoryReservations: [{ id: 90, userId: 1, createdAt: old }, { id: 91, userId: 3, createdAt: fresh }],
    passwordTokens: [{ id: 1000, userId: 1, createdAt: old }],
    verificationCodes: [{ id: 1001, userId: 1, createdAt: old }],
    customerNotes: [{ id: 1002, customerId: 1, authorId: 2, createdAt: old }],
    tagAssignments: [{ id: 1003, customerId: 1, createdAt: old }],
    auditLogs: [{ id: 1004, actorId: 1, entityType: "User", entityId: "1", createdAt: old }],
    adminNavViews: [{ id: 1005, userId: 2, viewedAt: old }],
    rateLimits: [{ key: "login:test", resetAt: old }],
    variants: [{ id: 200, productId: 100, isActive: true, stock: 7, sold: 2 }],
    products: [{ id: 100, stock: 7 }],
    categories: [{ id: 300 }],
    sections: [{ id: 400 }],
    settings: [{ id: 1 }],
  };

  const findMany = (key: keyof typeof state) => async ({ where }: Row = {}) =>
    (state[key] as Row[]).filter((row) => matchesWhere(row, where));
  const deleteMany = (key: keyof typeof state) => async ({ where }: Row = {}) => {
    const rows = state[key] as Row[];
    const kept = rows.filter((row) => !matchesWhere(row, where));
    const count = rows.length - kept.length;
    (state as Row)[key] = kept;
    return { count };
  };

  const emptyDelete = async () => ({ count: 0 });
  const tx = {
    user: { findMany: findMany("users"), deleteMany: deleteMany("users") },
    order: { findMany: findMany("orders"), deleteMany: deleteMany("orders") },
    supportTicket: { findMany: findMany("tickets"), deleteMany: deleteMany("tickets") },
    supportTicketAttachment: { findMany: findMany("attachments"), deleteMany: deleteMany("attachments") },
    supportRmaRequest: { findMany: findMany("rmaRequests"), deleteMany: deleteMany("rmaRequests") },
    cart: { findMany: findMany("carts"), deleteMany: deleteMany("carts") },
    cartItem: { deleteMany: deleteMany("cartItems") },
    favorite: { deleteMany: deleteMany("favorites") },
    productView: { deleteMany: deleteMany("productViews") },
    inventoryReservation: { deleteMany: deleteMany("inventoryReservations") },
    passwordResetToken: { deleteMany: deleteMany("passwordTokens") },
    emailVerificationCode: { deleteMany: deleteMany("verificationCodes") },
    customerNote: { deleteMany: deleteMany("customerNotes") },
    customerTagAssignment: { deleteMany: deleteMany("tagAssignments") },
    auditLog: { deleteMany: deleteMany("auditLogs") },
    adminNavAlertView: { deleteMany: deleteMany("adminNavViews") },
    rateLimitBucket: { deleteMany: deleteMany("rateLimits") },
    productVariant: {
      findUnique: async ({ where }: Row) => state.variants.find((variant) => variant.id === where.id) || null,
      update: async ({ where, data }: Row) => {
        const variant = state.variants.find((item) => item.id === where.id)!;
        variant.stock += data.stock.increment;
        variant.sold -= data.sold.decrement;
        return variant;
      },
      aggregate: async ({ where }: Row) => ({
        _sum: { stock: state.variants.filter((variant) => variant.productId === where.productId && variant.isActive).reduce((sum, variant) => sum + variant.stock, 0) },
      }),
    },
    product: {
      updateMany: async ({ where, data }: Row) => {
        const product = state.products.find((item) => item.id === where.id);
        if (!product) return { count: 0 };
        product.stock = data.stock;
        return { count: 1 };
      },
    },
    supportTicketInternalNote: { deleteMany: emptyDelete },
    supportTicketMessage: { deleteMany: emptyDelete },
    supportRmaItem: { deleteMany: emptyDelete },
    orderInventoryReservation: { deleteMany: emptyDelete },
    orderItem: { deleteMany: emptyDelete },
    adminPermission: { deleteMany: emptyDelete },
  };

  return { state, tx: tx as unknown as Prisma.TransactionClient, fresh };
}

function createAdminDatabase() {
  const users: Row[] = [];
  const carts: Row[] = [];
  return {
    users,
    carts,
    client: {
      user: {
        findUnique: async ({ where }: Row) => users.find((user) => user.email === where.email) || null,
        upsert: async ({ where, update, create }: Row) => {
          const existing = users.find((user) => user.email === where.email);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const user = { ...create, cart: undefined, id: users.length + 1 };
          users.push(user);
          if (create.cart) carts.push({ id: carts.length + 1, userId: user.id });
          return user;
        },
      },
      cart: {
        upsert: async ({ where, create }: Row) => {
          const existing = carts.find((cart) => cart.userId === where.userId);
          if (existing) return existing;
          const cart = { ...create, id: carts.length + 1 };
          carts.push(cart);
          return cart;
        },
      },
    },
  };
}

const demoEnv = {
  CREATE_TEST_ADMIN: "true",
  TEST_ADMIN_EMAIL: "admin@example.local",
  TEST_ADMIN_PASSWORD: "admin",
  TEST_ADMIN_USERNAME: "admin",
};

test("demo mode defaults are disabled and TTL falls back safely", () => {
  assert.equal(isDemoModeEnabled({}), false);
  assert.equal(getDemoDataTtlMinutes({}), 15);
  assert.equal(getDemoDataTtlMinutes({ DEMO_DATA_TTL_MINUTES: "0" }), 30);
  assert.equal(getDemoDataTtlMinutes({ DEMO_DATA_TTL_MINUTES: "30" }), 30);
});

test("test administrator bootstrap is opt-in, bcrypt-backed and idempotent", async () => {
  const disabled = createAdminDatabase();
  const disabledResult = await ensureTestAdmin(disabled.client, { env: { CREATE_TEST_ADMIN: "false" } });
  assert.equal(disabledResult.enabled, false);
  assert.equal(disabled.users.length, 0);

  const database = createAdminDatabase();
  const first = await ensureTestAdmin(database.client, { env: demoEnv, now: new Date("2026-08-11T12:00:00Z") });
  assert.equal(first.created, true);
  assert.equal(database.users.length, 1);
  assert.equal(database.carts.length, 1);
  assert.equal(first.user.role, "SUPER_ADMIN");
  assert.notEqual(first.user.passwordHash, "admin");
  assert.equal(await bcrypt.compare("admin", first.user.passwordHash), true);

  const second = await ensureTestAdmin(database.client, { env: demoEnv, now: new Date("2026-08-11T12:01:00Z") });
  assert.equal(second.created, false);
  assert.equal(database.users.length, 1);
  assert.equal(database.carts.length, 1);
});

test("admin username resolves to the configured email and keeps the normal auth path", () => {
  assert.equal(resolveLoginIdentifier("admin", demoEnv), "admin@example.local");
  assert.equal(resolveLoginIdentifier("admin", { ...demoEnv, CREATE_TEST_ADMIN: "false" }), "admin");

  const loginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
  assert.match(loginRoute, /resolveLoginIdentifier/);
  assert.match(loginRoute, /findUserByEmail/);
  assert.match(loginRoute, /bcrypt\.compare/);
  assert.match(loginRoute, /createSessionToken/);
  assert.doesNotMatch(loginRoute, /username\s*===\s*["']admin["']/);
});

test("demo administrator uses the existing session, logout and SUPER_ADMIN access checks", () => {
  const loginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
  const logoutRoute = readFileSync("app/api/auth/logout/route.ts", "utf8");
  const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");

  assert.match(loginRoute, /response\.cookies\.set\(sessionCookie\.name, token/);
  assert.match(logoutRoute, /sessionCookie\.name/);
  assert.match(logoutRoute, /maxAge:\s*0/);
  assert.match(adminLayout, /requireAdmin\(\)/);
  assert.match(adminLayout, /admin\.role === "SUPER_ADMIN"/);
});

test("example configuration keeps demo features disabled by default", () => {
  const example = readFileSync(".env.example", "utf8");
  assert.match(example, /DEMO_MODE="false"/);
  assert.match(example, /DEMO_DATA_TTL_MINUTES="30"/);
  assert.match(example, /CREATE_TEST_ADMIN="false"/);
  assert.match(example, /TEST_ADMIN_USERNAME="admin"/);
  assert.match(example, /TEST_ADMIN_PASSWORD="admin"/);
  assert.match(example, /TEST_ADMIN_EMAIL="admin@example\.local"/);
  assert.match(example, /CRON_SECRET=""/);
});

test("cron authorization requires an exact non-empty bearer secret", () => {
  const env = { CRON_SECRET: "demo-cron-secret" };
  assert.equal(hasValidCronSecret(new Request("https://store.example/api/internal/demo-cleanup"), env), false);
  assert.equal(hasValidCronSecret(new Request("https://store.example/api/internal/demo-cleanup", { headers: { authorization: "Bearer wrong" } }), env), false);
  assert.equal(hasValidCronSecret(new Request("https://store.example/api/internal/demo-cleanup", { headers: { authorization: "Bearer demo-cron-secret" } }), env), true);
  assert.equal(hasValidCronSecret(new Request("https://store.example/api/internal/demo-cleanup", { headers: { authorization: "Bearer demo-cron-secret" } }), {}), false);
});

test("stock restoration excludes pending, cancelled and already-restocked units", () => {
  const plan = calculateStockRestorePlan([
    { id: 1, status: "CONFIRMED", items: [{ productId: 10, variantId: 20, quantity: 3, rmaItems: [{ restockedQuantity: 1 }] }] },
    { id: 2, status: "DELIVERED", items: [{ productId: 10, variantId: 20, quantity: 2, rmaItems: [] }] },
    { id: 3, status: "PENDING", items: [{ productId: 10, variantId: 20, quantity: 9, rmaItems: [] }] },
    { id: 4, status: "CANCELLED", items: [{ productId: 10, variantId: 20, quantity: 9, rmaItems: [] }] },
  ]);
  assert.deepEqual(plan, [{ productId: 10, variantId: 20, quantity: 4 }]);
});

test("cleanup deletes expired demo transactions, preserves system records and is idempotent", async () => {
  const now = new Date("2026-08-11T12:00:00Z");
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const database = createCleanupDatabase(now);

  const first = await cleanupDemoDataInTransaction(database.tx, {
    cutoff,
    now,
    protectedAdminEmail: "admin@example.local",
  });
  assert.equal(first.usersDeleted, 1);
  assert.equal(first.ordersDeleted, 2);
  assert.equal(first.ticketsDeleted, 1);
  assert.equal(first.stockUnitsRestored, 1);
  assert.deepEqual(database.state.users.map((user) => user.id), [2, 3]);
  assert.deepEqual(database.state.orders.map((order) => order.id), [12]);
  assert.deepEqual(database.state.tickets.map((ticket) => ticket.id), [21]);
  assert.equal(database.state.variants[0].stock, 8);
  assert.equal(database.state.variants[0].sold, 1);
  assert.equal(database.state.products[0].stock, 8);
  assert.equal(database.state.products.length, 1);
  assert.equal(database.state.categories.length, 1);
  assert.equal(database.state.sections.length, 1);
  assert.equal(database.state.settings.length, 1);

  const second = await cleanupDemoDataInTransaction(database.tx, {
    cutoff,
    now,
    protectedAdminEmail: "admin@example.local",
  });
  assert.equal(second.usersDeleted, 0);
  assert.equal(second.ordersDeleted, 0);
  assert.equal(second.ticketsDeleted, 0);
  assert.equal(second.stockUnitsRestored, 0);
  assert.equal(database.state.variants[0].stock, 8);

  database.state.users.push({ id: 4, email: "next-demo@example.com", role: "CUSTOMER", createdAt: database.fresh });
  database.state.carts.push({ id: 53, userId: 4 });
  database.state.cartItems.push({ id: 62, cartId: 53, createdAt: database.fresh });
  database.state.orders.push({ id: 13, userId: 4, status: "PENDING", createdAt: database.fresh, items: [] });
  database.state.tickets.push({ id: 22, userId: 4, orderId: null, createdAt: database.fresh });
  await cleanupDemoDataInTransaction(database.tx, { cutoff, now, protectedAdminEmail: "admin@example.local" });
  assert.ok(database.state.users.some((user) => user.id === 4));
  assert.ok(database.state.cartItems.some((item) => item.id === 62));
  assert.ok(database.state.orders.some((order) => order.id === 13));
  assert.ok(database.state.tickets.some((ticket) => ticket.id === 22));
});

test("cleanup source contains database and production safety guards", () => {
  const wrapper = readFileSync("lib/demo-data-cleanup.ts", "utf8");
  const core = readFileSync("lib/demo-data-cleanup-core.ts", "utf8");
  const endpoint = readFileSync("app/api/internal/demo-cleanup/route.ts", "utf8");
  const combined = `${wrapper}\n${core}\n${endpoint}`;

  assert.match(wrapper, /if \(!isDemoModeEnabled\(env\)\) throw new DemoCleanupDisabledError/);
  assert.match(endpoint, /hasValidCronSecret/);
  assert.match(core, /role:\s*"CUSTOMER"/);
  assert.match(core, /Prisma\.TransactionClient/);
  assert.doesNotMatch(combined, /DROP DATABASE|DROP SCHEMA|TRUNCATE|migrate reset|force-reset|setInterval/i);
  for (const protectedModel of ["catalogSection", "category", "siteDesignSettings", "designTheme", "legalSettings", "marketingIntegrationSettings", "productAttributeOption", "sizeGuide"]) {
    assert.doesNotMatch(core, new RegExp(`${protectedModel}\\.delete`, "i"));
  }
});

// social persistence regression guard added by V11
