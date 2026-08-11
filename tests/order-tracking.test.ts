import assert from "node:assert/strict";
import test from "node:test";
import {
  getCourierTrackingPortal,
  getLastActiveOrderStatus,
  getOrderTrackingSteps,
  isDemoShipment,
} from "../lib/order-tracking";

test("order tracker marks the current and completed customer-visible stages", () => {
  assert.deepEqual(getOrderTrackingSteps("PENDING").map((step) => step.state), ["current", "upcoming", "upcoming", "upcoming"]);
  assert.deepEqual(getOrderTrackingSteps("SHIPPED").map((step) => step.state), ["completed", "completed", "current", "upcoming"]);
  assert.deepEqual(getOrderTrackingSteps("DELIVERED").map((step) => step.state), ["completed", "completed", "completed", "current"]);
});

test("cancelled orders retain their last real progress stage for the timeline", () => {
  const status = getLastActiveOrderStatus("CANCELLED", {
    confirmedAt: new Date("2026-07-20T10:00:00Z"),
    shippedAt: null,
    deliveredAt: null,
  });
  assert.equal(status, "CONFIRMED");
});

test("courier tracking uses official public portals and hides demo shipments", () => {
  assert.equal(getCourierTrackingPortal("ECONT")?.url, "https://www.econt.com/services/track-shipment");
  assert.equal(getCourierTrackingPortal("SPEEDY")?.url, "https://www.speedy.bg/public/index.php/bg/track-shipment");
  assert.equal(getCourierTrackingPortal("OTHER"), null);
  assert.equal(isDemoShipment("SPD-DEMO-42-123"), true);
  assert.equal(isDemoShipment("123456789"), false);
});
