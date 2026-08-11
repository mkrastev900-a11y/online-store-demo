import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EMAIL_BRAND_NAME,
  EMAIL_BRAND_NAME_UPPER,
  getEmailAddressConfig,
  getTransactionalEmailEnvelope,
} from "../lib/email-config";

const ENV_KEYS = [
  "NODE_ENV",
  "RESEND_TEST_MODE",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_SUPPORT",
  "EMAIL_ORDERS",
  "RESEND_FROM_EMAIL",
  "RESEND_REPLY_TO_EMAIL",
] as const;

function withEmailEnvironment(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(values)) Reflect.set(process.env, key, value);
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else Reflect.set(process.env, key, value);
    }
  }
}

test("live production uses the verified sender and category-specific reply-to addresses", () => {
  withEmailEnvironment({
    NODE_ENV: "production",
    RESEND_TEST_MODE: "false",
    EMAIL_FROM: "noreply@store.example",
    EMAIL_REPLY_TO: "office@store.example",
    EMAIL_SUPPORT: "support@store.example",
    EMAIL_ORDERS: "orders@store.example",
    RESEND_FROM_EMAIL: "Legacy Sender <onboarding@resend.dev>",
  }, () => {
    const config = getEmailAddressConfig();
    assert.equal(config.from, "Online Store <noreply@store.example>");
    assert.deepEqual(getTransactionalEmailEnvelope("system"), {
      from: "Online Store <noreply@store.example>",
      replyTo: "office@store.example",
    });
    assert.equal(getTransactionalEmailEnvelope("order").replyTo, "orders@store.example");
    assert.equal(getTransactionalEmailEnvelope("support").replyTo, "support@store.example");
  });
});

test("live production reports a clear error instead of falling back to the Resend test sender", () => {
  withEmailEnvironment({
    NODE_ENV: "production",
    RESEND_TEST_MODE: "false",
    EMAIL_REPLY_TO: "office@store.example",
    EMAIL_SUPPORT: "support@store.example",
    EMAIL_ORDERS: "orders@store.example",
    RESEND_FROM_EMAIL: "Legacy Sender <onboarding@resend.dev>",
  }, () => {
    assert.throws(() => getEmailAddressConfig(), /Липсва EMAIL_FROM/);
  });
});

test("development and explicit Resend test mode preserve the legacy safe sender fallback", () => {
  withEmailEnvironment({
    NODE_ENV: "production",
    RESEND_TEST_MODE: "true",
    RESEND_FROM_EMAIL: "Legacy Sender <onboarding@resend.dev>",
    RESEND_REPLY_TO_EMAIL: "test-replies@example.com",
  }, () => {
    const config = getEmailAddressConfig();
    assert.equal(config.from, "Online Store <onboarding@resend.dev>");
    assert.equal(config.replyTo.system, "test-replies@example.com");
    assert.equal(config.replyTo.order, "test-replies@example.com");
    assert.equal(config.replyTo.support, "test-replies@example.com");
  });
});

test("every real transactional category is routed centrally and customer emails request a footer", () => {
  const source = readFileSync("lib/email.ts", "utf8");
  const configSource = readFileSync("lib/email-config.ts", "utf8");
  const forgotPasswordSource = readFileSync("app/api/auth/forgot-password/route.ts", "utf8");

  assert.doesNotMatch(source, /process\.env\.(?:EMAIL_FROM|EMAIL_REPLY_TO|EMAIL_SUPPORT|EMAIL_ORDERS|RESEND_FROM_EMAIL|RESEND_REPLY_TO_EMAIL)/);
  assert.match(source, /CONTACT:\s*"support"/);
  assert.match(source, /ORDER_CREATED:\s*"order"/);
  assert.match(source, /ORDER_STATUS:\s*"order"/);
  assert.match(source, /PASSWORD_RESET:\s*"system"/);
  assert.match(source, /EMAIL_VERIFICATION:\s*"system"/);
  assert.match(source, /SUPPORT_REPLY:\s*"support"/);
  assert.ok((source.match(/automaticFooter:\s*true/g) ?? []).length >= 5);
  assert.equal(EMAIL_BRAND_NAME, "Online Store");
  assert.equal(EMAIL_BRAND_NAME_UPPER, "ONLINE STORE");
  assert.match(configSource, /\$\{EMAIL_BRAND_NAME\} <\$\{fromAddress\}>/);
  assert.doesNotMatch(configSource, /gmail\.com/i);
  assert.doesNotMatch(forgotPasswordSource, /RESEND_FROM_EMAIL/);
});

test("customer-facing email branding uses the centralized generic fallback", () => {
  const source = readFileSync("lib/email.ts", "utf8");

  assert.match(source, /EMAIL_BRAND_NAME/);
  assert.match(source, /EMAIL_BRAND_NAME_UPPER/);
  assert.doesNotMatch(source, /zlatevi|златев/i);
  assert.ok((source.match(/EMAIL_BRAND_NAME_UPPER/g) ?? []).length >= 5);
  assert.ok((source.match(/EMAIL_BRAND_NAME/g) ?? []).length >= 6);
});
