import { isValidPhoneCharacters, phoneCharactersOnly } from "@/lib/numeric-fields";

export const CONTACT_TOPICS = [
  "ORDER",
  "PRODUCT",
  "DELIVERY",
  "RETURN",
  "OTHER",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  ORDER: "Въпрос за поръчка",
  PRODUCT: "Въпрос за продукт",
  DELIVERY: "Доставка",
  RETURN: "Връщане или рекламация",
  OTHER: "Друго",
};

export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  topic: ContactTopic;
  orderNumber: string;
  message: string;
  consent: true;
};

type ContactValidationResult =
  | { ok: true; data: ContactMessage }
  | { ok: false; error: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateContactMessage(input: unknown): ContactValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Невалидни данни." };
  }

  const body = input as Record<string, unknown>;
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const phone = phoneCharactersOnly(text(body.phone));
  const topic = text(body.topic) as ContactTopic;
  const orderNumber = text(body.orderNumber);
  const message = text(body.message);

  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "Името трябва да е между 2 и 100 знака." };
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)
  ) {
    return { ok: false, error: "Въведи валиден имейл адрес." };
  }

  if (phone.length > 40 || !isValidPhoneCharacters(phone)) {
    return { ok: false, error: "Телефонът може да съдържа само цифри и една начална +." };
  }

  if (!CONTACT_TOPICS.includes(topic)) {
    return { ok: false, error: "Избери тема на запитването." };
  }

  if (orderNumber.length > 40) {
    return { ok: false, error: "Номерът на поръчката е прекалено дълъг." };
  }

  if (message.length < 10 || message.length > 3000) {
    return {
      ok: false,
      error: "Съобщението трябва да е между 10 и 3000 знака.",
    };
  }

  if (body.consent !== true) {
    return {
      ok: false,
      error: "Необходимо е съгласие за обработване на данните от формата.",
    };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      phone,
      topic,
      orderNumber,
      message,
      consent: true,
    },
  };
}
