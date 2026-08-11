import assert from "node:assert/strict";
import test from "node:test";

import { validateContactMessage } from "../lib/contact";
import {
  applyContactProfile,
  formatContactOrderOption,
} from "../lib/contact-prefill";

test("contact form validates and normalizes a complete message", () => {
  const result = validateContactMessage({
    name: "  Мария Иванова  ",
    email: "  MARIA@example.com ",
    phone: "0888 123 456",
    topic: "ORDER",
    orderNumber: " #1042 ",
    message: "  Искам информация за доставката на поръчката.  ",
    consent: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.name, "Мария Иванова");
    assert.equal(result.data.email, "maria@example.com");
    assert.equal(result.data.orderNumber, "#1042");
  }
});

test("contact form rejects invalid email addresses", () => {
  const result = validateContactMessage({
    name: "Мария",
    email: "maria-at-example",
    topic: "OTHER",
    message: "Това е достатъчно дълго съобщение.",
    consent: true,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Въведи валиден имейл адрес.",
  });
});

test("contact form requires explicit privacy consent", () => {
  const result = validateContactMessage({
    name: "Мария",
    email: "maria@example.com",
    topic: "PRODUCT",
    message: "Имам въпрос за размера на продукта.",
    consent: false,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Необходимо е съгласие за обработване на данните от формата.",
  });
});

test("contact profile restores name, email and the current phone field", () => {
  const result = applyContactProfile(
    { name: "", email: "", phone: "" },
    {
      name: "Мария Иванова",
      email: "maria@example.com",
      phone: "0888 123 456",
    },
  );

  assert.deepEqual(result, {
    name: "Мария Иванова",
    email: "maria@example.com",
    phone: "0888 123 456",
  });
});

test("late profile loading never overwrites contact data already typed by the user", () => {
  const result = applyContactProfile(
    { name: "Друго име", email: "other@example.com", phone: "0899" },
    {
      name: "Мария Иванова",
      email: "maria@example.com",
      phone: "0888 123 456",
    },
  );

  assert.equal(result.name, "Друго име");
  assert.equal(result.email, "other@example.com");
  assert.equal(result.phone, "0899");
});

test("contact order dropdown hides internal order number and shows date, total, status and products", () => {
  const label = formatContactOrderOption({
    id: 1042,
    status: "CONFIRMED",
    total: 86,
    createdAt: "2026-07-22T08:00:00.000Z",
    items: [{ id: 501, name: "Бордо рокля", size: "M", quantity: 1, price: 86 }],
  });

  assert.doesNotMatch(label, /#1042/);
  assert.match(label, /86/);
  assert.match(label, /Потвърдена/);
  assert.match(label, /Бордо рокля/);
});
