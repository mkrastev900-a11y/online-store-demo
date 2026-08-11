import assert from "node:assert/strict";
import test from "node:test";
import { toCartSummary } from "../lib/cart-events";
import { toFavoriteSummary } from "../lib/favorite-events";
import { createHeaderScrollState, nextHeaderScrollState } from "../lib/header-scroll";
import { isStorefrontPath, PUBLIC_NAVIGATION } from "../lib/navigation";

test("public navigation replaces Brands with About after Contacts", () => {
  const publicHrefs = PUBLIC_NAVIGATION.map((item) => String(item.href));
  assert.equal(publicHrefs.includes("/brands"), false);
  const contactIndex = PUBLIC_NAVIGATION.findIndex((item) => item.href === "/contact");
  assert.equal(PUBLIC_NAVIGATION[contactIndex + 1]?.href, "/about");
  assert.equal(PUBLIC_NAVIGATION[contactIndex + 1]?.label, "За нас");
});

test("persistent store header is excluded from admin and print routes", () => {
  assert.equal(isStorefrontPath("/"), true);
  assert.equal(isStorefrontPath("/women"), true);
  assert.equal(isStorefrontPath("/products/elegantna-roklya"), true);
  assert.equal(isStorefrontPath("/admin"), false);
  assert.equal(isStorefrontPath("/admin/orders"), false);
  assert.equal(isStorefrontPath("/print/erp-document/12"), false);
});

test("cart summary normalizes live header values", () => {
  assert.deepEqual(toCartSummary({ totalItems: 3, subtotal: 87.35 }), { totalItems: 3, subtotal: 87.35 });
  assert.deepEqual(toCartSummary({ totalItems: -2, subtotal: Number.NaN }), { totalItems: 0, subtotal: 0 });
});

test("favorites summary accepts API counts and mutation result arrays", () => {
  assert.deepEqual(toFavoriteSummary({ count: 4 }), { count: 4 });
  assert.deepEqual(toFavoriteSummary({ favorites: [{ id: 1 }, { id: 2 }] }), {
    count: 2,
  });
  assert.deepEqual(toFavoriteSummary([{ id: 1 }]), { count: 1 });
  assert.deepEqual(toFavoriteSummary({ count: -3 }), { count: 0 });
});

test("desktop header uses scroll hysteresis instead of toggling on tiny movements", () => {
  let state = createHeaderScrollState(0);
  state = nextHeaderScrollState(state, 120, true, 100);
  state = nextHeaderScrollState(state, 179, true, 150);
  assert.equal(state.compact, false);

  state = nextHeaderScrollState(state, 214, true, 220);
  assert.equal(state.compact, true);

  state = nextHeaderScrollState(state, 213, true, 240);
  state = nextHeaderScrollState(state, 214, true, 260);
  assert.equal(state.compact, true);
});

test("header ignores a layout jump immediately after collapsing", () => {
  let state = createHeaderScrollState(140);
  state = nextHeaderScrollState(state, 190, true, 500);
  assert.equal(state.compact, true);

  state = nextHeaderScrollState(state, 100, true, 520);
  assert.equal(state.compact, true);

  state = nextHeaderScrollState(state, 75, true, 1000);
  state = nextHeaderScrollState(state, 40, true, 1050);
  assert.equal(state.compact, false);
});

test("compact header is always disabled below the desktop breakpoint", () => {
  let state = createHeaderScrollState(200);
  state = nextHeaderScrollState(state, 250, true, 100);
  assert.equal(state.compact, true);
  state = nextHeaderScrollState(state, 250, false, 120);
  assert.equal(state.compact, false);
});
