import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  digitsOnly,
  hasOnlyDigits,
  isValidPhoneCharacters,
  phoneCharactersOnly,
} from "../lib/numeric-fields";

test("numeric field filter removes letters, spaces and punctuation", () => {
  assert.equal(digitsOnly("+359 (88) 12A-34"), "359881234");
  assert.equal(digitsOnly("ПК 10 00"), "1000");
});

test("phone filter preserves one leading plus for an international code", () => {
  assert.equal(phoneCharactersOnly("+359 (88) 12A-34"), "+359881234");
  assert.equal(phoneCharactersOnly("++359-888"), "+359888");
  assert.equal(phoneCharactersOnly("0888 123 456"), "0888123456");
});

test("server-side numeric validation accepts only ASCII digits", () => {
  assert.equal(hasOnlyDigits("0888123456"), true);
  assert.equal(hasOnlyDigits("1000"), true);
  assert.equal(hasOnlyDigits(""), true);
  assert.equal(hasOnlyDigits("+359888123456"), false);
  assert.equal(hasOnlyDigits("0888 123 456"), false);
  assert.equal(hasOnlyDigits("10A0"), false);
});

test("server-side phone validation permits only digits and one leading plus", () => {
  assert.equal(isValidPhoneCharacters("+359888123456"), true);
  assert.equal(isValidPhoneCharacters("0888123456"), true);
  assert.equal(isValidPhoneCharacters(""), true);
  assert.equal(isValidPhoneCharacters("+"), false);
  assert.equal(isValidPhoneCharacters("359+888"), false);
  assert.equal(isValidPhoneCharacters("+359 888"), false);
});

test("every audited phone and postal form uses numeric keyboard and pattern", () => {
  const expectedNumericInputs = new Map([
    ["components/auth/RegisterForm.tsx", { phone: 1, postal: 0 }],
    ["components/account/ProfileInfoForm.tsx", { phone: 1, postal: 1 }],
    ["components/checkout/CheckoutClient.tsx", { phone: 1, postal: 1 }],
    ["components/contact/ContactForm.tsx", { phone: 1, postal: 0 }],
  ]);

  for (const [file, expected] of expectedNumericInputs) {
    const source = readFileSync(file, "utf8");
    assert.equal(
      source.match(/inputMode="tel"/g)?.length ?? 0,
      expected.phone,
      `${file} must protect all audited phone inputs`,
    );
    assert.equal(
      source.match(/inputMode="numeric"/g)?.length ?? 0,
      expected.postal,
      `${file} must protect all audited postal inputs`,
    );
    assert.equal(
      source.match(/pattern="\[\+\]\?\[0-9\]\+"/g)?.length ?? 0,
      expected.phone,
    );
    assert.equal(
      source.match(/pattern="\[0-9\]\*"/g)?.length ?? 0,
      expected.postal,
    );
    if (expected.phone) assert.match(source, /phoneCharactersOnly/);
    if (expected.postal) assert.match(source, /digitsOnly/);
  }
});
