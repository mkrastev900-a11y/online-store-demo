import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Prisma } from "@prisma/client";

import { generatePaymentDocumentPdf } from "../lib/order-payment-document";
import {
  orderCreatedCustomerIntro,
  sendNewOrderEmails,
} from "../lib/email";

const ENV_KEYS = [
  "ADMIN_NOTIFICATION_EMAILS",
  "CONTACT_RECIPIENT_EMAILS",
  "EMAIL_FROM",
  "EMAIL_ORDERS",
  "EMAIL_REPLY_TO",
  "EMAIL_SUPPORT",
  "NODE_ENV",
  "RESEND_API_KEY",
  "RESEND_BASE_URL",
  "RESEND_TEST_MODE",
  "RESEND_TEST_RECIPIENT",
] as const;

type CapturedEmailRequest = {
  method: string | undefined;
  url: string | undefined;
  body: Record<string, unknown>;
};

function sampleOrder(): Parameters<typeof sendNewOrderEmails>[0] {
  return {
    id: 87234,
    status: "PENDING",
    total: new Prisma.Decimal("67.98"),
    customerName: "Тест Клиент",
    customerEmail: "client@example.com",
    customerPhone: "0888123456",
    address: "ул. Тестова 1",
    city: "София",
    postalCode: "1000",
    country: "Bulgaria",
    deliveryMethod: "ADDRESS",
    paymentMethod: "CASH_ON_DELIVERY",
    shippingCost: new Prisma.Decimal("0"),
    courierProvider: "ECONT",
    courierOfficeName: null,
    courierOfficeAddress: null,
    shipmentNumber: null,
    paymentStatus: "PAYMENT_ON_DELIVERY",
    promoCode: null,
    promoDiscount: new Prisma.Decimal("0"),
    vatRegisteredAtSale: false,
    vatRateAtSale: new Prisma.Decimal("0"),
    taxBaseAtSale: new Prisma.Decimal("67.98"),
    vatAmountAtSale: new Prisma.Decimal("0"),
    notes: null,
    createdAt: new Date("2026-08-07T10:00:00.000Z"),
    items: [
      {
        name: "Къса пола",
        size: "M",
        sku: "SKU-TEST-1",
        price: new Prisma.Decimal("33.99"),
        quantity: 2,
      },
    ],
  };
}

async function readJsonBody(request: IncomingMessage) {
  let raw = "";
  request.setEncoding("utf8");
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function withMockResend(run: (requests: CapturedEmailRequest[], baseUrl: string) => Promise<void>) {
  const requests: CapturedEmailRequest[] = [];
  const server = createServer(async (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      body: await readJsonBody(request),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: `email_${requests.length}` }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    await run(requests, `http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function withEmailEnvironment(
  values: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) Reflect.set(process.env, key, value);
    }
    await run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else Reflect.set(process.env, key, value);
    }
  }
}

function liveEmailEnv(baseUrl: string) {
  return {
    ADMIN_NOTIFICATION_EMAILS: "",
    CONTACT_RECIPIENT_EMAILS: "",
    EMAIL_FROM: "noreply@store.example",
    EMAIL_ORDERS: "orders@store.example",
    EMAIL_REPLY_TO: "office@store.example",
    EMAIL_SUPPORT: "support@store.example",
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test_123",
    RESEND_BASE_URL: baseUrl,
    RESEND_TEST_MODE: "false",
  };
}

function utf16BeHex(value: string) {
  let hex = "";
  for (let index = 0; index < value.length; index += 1) {
    hex += value.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return hex;
}

test("order confirmation email sends a valid payment PDF attachment through Resend", async (t) => {
  t.mock.method(console, "error", () => {});

  const order = sampleOrder();
  const generatedPdf = await generatePaymentDocumentPdf(order);
  const generatedPdfText = generatedPdf.toString("ascii");

  assert.ok(generatedPdf.length > 0);
  assert.equal(generatedPdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(generatedPdf.includes(Buffer.from("SKU-TEST-1")), false);
  assert.doesNotMatch(generatedPdfText, /SKU:/);
  assert.doesNotMatch(generatedPdfText, new RegExp(utf16BeHex("SKU-TEST-1"), "i"));

  await withMockResend(async (requests, baseUrl) => {
    await withEmailEnvironment(liveEmailEnv(baseUrl), async () => {
      let generatorCalls = 0;
      await sendNewOrderEmails(order, {
        generatePaymentDocumentPdf: async () => {
          generatorCalls += 1;
          return generatedPdf;
        },
      });

      assert.equal(generatorCalls, 1);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].method, "POST");
      assert.equal(requests[0].url, "/emails");

      const payload = requests[0].body;
      assert.equal(payload.from, "Online Store <noreply@store.example>");
      assert.deepEqual(payload.to, ["client@example.com"]);
      assert.equal(payload.reply_to, "orders@store.example");
      assert.equal(payload.subject, "Получихме поръчката ти | Online Store");
      assert.match(String(payload.html), /Поръчката ти е приета/);
      assert.match(String(payload.html), /ONLINE STORE/);
      assert.doesNotMatch(String(payload.html), /zlatevi|златев/i);
      assert.match(String(payload.html), /Платежният документ е приложен към този имейл като PDF файл\./);
      assert.match(String(payload.html), /Размер: M/);
      assert.doesNotMatch(String(payload.html), /SKU:/);
      assert.doesNotMatch(String(payload.html), /SKU-TEST-1/);

      const attachments = payload.attachments as Array<Record<string, unknown>>;
      assert.equal(attachments.length, 1);
      assert.match(String(attachments[0].filename), /^platezhen-dokument-2026-08-07\.pdf$/);
      assert.equal(attachments[0].content_type, "application/pdf");
      assert.equal(attachments[0].content, generatedPdf.toString("base64"));

      const decoded = Buffer.from(String(attachments[0].content), "base64");
      assert.deepEqual(decoded, generatedPdf);
      assert.equal(decoded.subarray(0, 5).toString("ascii"), "%PDF-");
    });
  });
});

test("order confirmation email does not claim a PDF attachment when generation fails", async (t) => {
  t.mock.method(console, "error", () => {});

  await withMockResend(async (requests, baseUrl) => {
    await withEmailEnvironment(liveEmailEnv(baseUrl), async () => {
      await sendNewOrderEmails(sampleOrder(), {
        generatePaymentDocumentPdf: async () => {
          throw new Error("simulated pdf failure");
        },
      });

      assert.equal(requests.length, 1);
      const payload = requests[0].body;
      assert.equal("attachments" in payload, false);
      assert.doesNotMatch(String(payload.html), /Платежният документ е приложен към този имейл като PDF файл\./);
      assert.match(String(payload.html), /Платежният документ не беше приложен автоматично/);
      assert.equal(orderCreatedCustomerIntro(false).includes("приложен към този имейл"), false);
    });
  });
});
