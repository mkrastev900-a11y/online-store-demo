import assert from "node:assert/strict";
import test from "node:test";
import { createEpayPayment, parseEpayNotifications, verifyEpayNotification } from "../lib/payments/epay";
import { trackEcontShipment } from "../lib/shipping/econt";
import { shippingConfig } from "../lib/shipping/index";
import { createSpeedyShipment, getSpeedyLabelPdf, isSpeedyConfigured, listSpeedyOffices, quoteSpeedy, trackSpeedyShipment } from "../lib/shipping/speedy";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
}

function speedyRequest() {
  return {
    orderId: 42, courierProvider: "SPEEDY" as const, deliveryMethod: "OFFICE" as const,
    office: { provider: "SPEEDY" as const, id: "990001", name: "Офис", address: "София", city: "София", postalCode: "1000", type: "OFFICE" as const },
    paymentMethod: "CASH_ON_DELIVERY" as const, amountToCollect: 50, weightKg: 0.5, description: "Дрехи",
    customerName: "Тест Клиент", customerEmail: "test@example.com", customerPhone: "0888123456",
    address: "", city: "София", postalCode: "1000", country: "Bulgaria",
  };
}

test("ePay payment payload is signed and contains the order data", () => {
  const previous = { min: process.env.EPAY_MIN, secret: process.env.EPAY_SECRET, environment: process.env.EPAY_ENV };
  process.env.EPAY_MIN = "D123456789";
  process.env.EPAY_SECRET = "test-secret";
  process.env.EPAY_ENV = "demo";
  try {
    const payment = createEpayPayment({ id: 42, total: 87.35 });
    assert.equal(payment.endpoint, "https://demo.epay.bg/");
    assert.equal(verifyEpayNotification(payment.encoded, payment.checksum), true);
    const decoded = Buffer.from(payment.encoded, "base64").toString("utf8");
    assert.match(decoded, /INVOICE=42/);
    assert.match(decoded, /AMOUNT=87\.35/);
    assert.match(decoded, /CURRENCY=EUR/);
  } finally {
    restoreEnv("EPAY_MIN", previous.min);
    restoreEnv("EPAY_SECRET", previous.secret);
    restoreEnv("EPAY_ENV", previous.environment);
  }
});

test("ePay callback parser handles all documented terminal states", () => {
  const encoded = Buffer.from([
    "INVOICE=101:STATUS=PAID:PAY_TIME=202607211602:STAN=123456:BCODE=ABC",
    "INVOICE=102:STATUS=DENIED",
    "INVOICE=103:STATUS=EXPIRED",
  ].join("\n")).toString("base64");
  assert.deepEqual(parseEpayNotifications(encoded).map((item) => [item.invoice, item.status]), [[101, "PAID"], [102, "DENIED"], [103, "EXPIRED"]]);
});



test("ePay callback parser handles multiple invoices even without newline separators", () => {
  const encoded = Buffer.from(
    "INVOICE=201:STATUS=PAID:PAY_TIME=20260807050000:STAN=123456:BCODE=ABC123 INVOICE=202:STATUS=EXPIRED",
  ).toString("base64");
  assert.deepEqual(
    parseEpayNotifications(encoded).map((item) => [item.invoice, item.status]),
    [[201, "PAID"], [202, "EXPIRED"]],
  );
});

test("shipping configuration exposes both supported couriers", () => {
  const config = shippingConfig();
  assert.equal(config.providers.ECONT.label, "Еконт");
  assert.equal(config.providers.SPEEDY.label, "Спиди");
  assert.ok(config.freeThreshold > 0);
});

test("Speedy calculation uses the documented request shape", async () => {
  const previous = { environment: process.env.SPEEDY_ENV, username: process.env.SPEEDY_USERNAME, password: process.env.SPEEDY_PASSWORD, fetch: global.fetch };
  process.env.SPEEDY_ENV = "production";
  process.env.SPEEDY_USERNAME = "demo-user";
  process.env.SPEEDY_PASSWORD = "demo-password";
  let sent: Record<string, unknown> = {};
  global.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ calculations: [{ serviceId: 505, price: { total: 6.2, currency: "EUR" } }] }), { status: 200 });
  };
  try {
    const quote = await quoteSpeedy({ ...speedyRequest(), orderId: 0, office: { ...speedyRequest().office, id: "123" } });
    assert.equal(quote.amount, 6.2);
    assert.deepEqual((sent.service as { serviceIds: number[] }).serviceIds, [505]);
    assert.equal((sent.recipient as { pickupOfficeId: number }).pickupOfficeId, 123);
    assert.equal("calculations" in sent, false);
  } finally {
    global.fetch = previous.fetch;
    restoreEnv("SPEEDY_ENV", previous.environment);
    restoreEnv("SPEEDY_USERNAME", previous.username);
    restoreEnv("SPEEDY_PASSWORD", previous.password);
  }
});

test("Speedy demo mode simulates offices, prices, shipments and a PDF without network access", async () => {
  const previous = { environment: process.env.SPEEDY_ENV, username: process.env.SPEEDY_USERNAME, password: process.env.SPEEDY_PASSWORD, fetch: global.fetch };
  process.env.SPEEDY_ENV = "demo";
  delete process.env.SPEEDY_USERNAME;
  delete process.env.SPEEDY_PASSWORD;
  global.fetch = async () => { throw new Error("Demo mode must not call the network"); };
  try {
    assert.equal(isSpeedyConfigured(), true);
    const offices = await listSpeedyOffices("Център", "София");
    assert.ok(offices.length > 0);
    assert.match(offices[0].name, /ТЕСТ/);

    const request = { ...speedyRequest(), office: offices[0] };
    const quote = await quoteSpeedy(request);
    assert.equal(quote.source, "DEMO");
    assert.ok(quote.amount > 0);

    const shipment = await createSpeedyShipment(request);
    assert.match(shipment.shipmentNumber, /^SPD-DEMO-/);
    assert.equal(shipment.status, "DEMO");

    const pdf = await getSpeedyLabelPdf(shipment.shipmentNumber);
    assert.equal(Buffer.from(pdf).subarray(0, 8).toString("ascii"), "%PDF-1.4");
  } finally {
    global.fetch = previous.fetch;
    restoreEnv("SPEEDY_ENV", previous.environment);
    restoreEnv("SPEEDY_USERNAME", previous.username);
    restoreEnv("SPEEDY_PASSWORD", previous.password);
  }
});

test("Speedy live tracking stays server-side and normalizes courier events", async () => {
  const previous = { environment: process.env.SPEEDY_ENV, username: process.env.SPEEDY_USERNAME, password: process.env.SPEEDY_PASSWORD, fetch: global.fetch };
  process.env.SPEEDY_ENV = "production";
  process.env.SPEEDY_USERNAME = "demo-user";
  process.env.SPEEDY_PASSWORD = "demo-password";
  let sent: Record<string, unknown> = {};
  global.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ parcels: [{ parcelId: "123", operations: [{ dateTime: "2026-07-22T10:00:00Z", operationCode: 12, place: "София", description: "Разнос" }] }] }), { status: 200 });
  };
  try {
    const tracking = await trackSpeedyShipment("123");
    assert.deepEqual(sent.parcels, [{ id: "123" }]);
    assert.equal(sent.lastOperationOnly, true);
    assert.equal(tracking.status, "Разнос");
    assert.equal(tracking.events[0].location, "София");
  } finally {
    global.fetch = previous.fetch;
    restoreEnv("SPEEDY_ENV", previous.environment);
    restoreEnv("SPEEDY_USERNAME", previous.username);
    restoreEnv("SPEEDY_PASSWORD", previous.password);
  }
});

test("Econt live tracking uses shipment status API and maps the event history", async () => {
  const previous = { environment: process.env.ECONT_ENV, username: process.env.ECONT_USERNAME, password: process.env.ECONT_PASSWORD, fetch: global.fetch };
  process.env.ECONT_ENV = "production";
  process.env.ECONT_USERNAME = "demo-user";
  process.env.ECONT_PASSWORD = "demo-password";
  let sent: Record<string, unknown> = {};
  global.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ shipmentStatuses: [{ status: { shipmentNumber: "456", shortDeliveryStatus: "В движение", trackingEvents: [{ destinationDetails: "Приета в офис", officeName: "София Център", time: "2026-07-22T09:00:00Z" }] } }] }), { status: 200 });
  };
  try {
    const tracking = await trackEcontShipment("456");
    assert.deepEqual(sent.shipmentNumbers, ["456"]);
    assert.equal(tracking.status, "В движение");
    assert.equal(tracking.events[0].description, "Приета в офис");
  } finally {
    global.fetch = previous.fetch;
    restoreEnv("ECONT_ENV", previous.environment);
    restoreEnv("ECONT_USERNAME", previous.username);
    restoreEnv("ECONT_PASSWORD", previous.password);
  }
});
