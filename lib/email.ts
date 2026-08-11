import { OrderStatus, type Order, type OrderItem } from "@prisma/client";
import { Resend } from "resend";
import { writeAuditLog } from "@/lib/audit";

import {
  CONTACT_TOPIC_LABELS,
  type ContactMessage,
} from "@/lib/contact";
import {
  EMAIL_BRAND_NAME,
  EMAIL_BRAND_NAME_UPPER,
  getTransactionalEmailEnvelope,
  type TransactionalEmailCategory,
} from "@/lib/email-config";

type OrderForEmail = Pick<
  Order,
  | "id"
  | "status"
  | "total"
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "address"
  | "city"
  | "postalCode"
  | "country"
  | "deliveryMethod"
  | "paymentMethod"
  | "shippingCost"
  | "promoCode"
  | "promoDiscount"
  | "courierProvider"
  | "courierOfficeName"
  | "courierOfficeAddress"
  | "shipmentNumber"
  | "paymentStatus"
  | "vatRegisteredAtSale"
  | "vatRateAtSale"
  | "taxBaseAtSale"
  | "vatAmountAtSale"
  | "notes"
  | "createdAt"
> & {
  items: Array<
    Pick<OrderItem, "name" | "size" | "sku" | "price" | "quantity">
  >;
};

type SafeEmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type PaymentDocumentGenerator = (order: OrderForEmail) => Promise<Buffer | Uint8Array>;

const PDF_MAGIC_BYTES = "%PDF-";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Нова",
  CONFIRMED: "Потвърдена",
  SHIPPED: "Изпратена",
  DELIVERED: "Доставена",
  CANCELLED: "Отказана",
};

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  PENDING: "Получихме поръчката ти и скоро ще я прегледаме.",
  CONFIRMED: "Поръчката ти е потвърдена и се подготвя за изпращане.",
  SHIPPED: "Поръчката ти е изпратена към посочения адрес или офис.",
  DELIVERED: "Поръчката е отбелязана като доставена. Благодарим ти!",
  CANCELLED: "Поръчката е отказана. При въпроси можеш да се свържеш с нас.",
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function deliveryLabel(value: string) {
  return value === "OFFICE" ? "До офис / автомат" : "До адрес";
}

function paymentLabel(value: string) {
  return value === "CARD" ? "Онлайн с карта" : "При получаване (пощенски паричен превод)";
}

export function orderCreatedCustomerIntro(hasPaymentDocumentAttachment: boolean) {
  return hasPaymentDocumentAttachment
    ? `${STATUS_MESSAGES.PENDING} Платежният документ е приложен към този имейл като PDF файл.`
    : `${STATUS_MESSAGES.PENDING} Платежният документ не беше приложен автоматично; ще обработим поръчката ти и при нужда ще се свържем с теб.`;
}

function paymentDocumentFilename(order: OrderForEmail) {
  return `platezhen-dokument-${order.createdAt.toISOString().slice(0, 10)}.pdf`;
}

export function buildPaymentDocumentAttachment(order: OrderForEmail, paymentDocument: Buffer | Uint8Array): SafeEmailAttachment {
  const buffer = Buffer.isBuffer(paymentDocument)
    ? paymentDocument
    : Buffer.from(paymentDocument.buffer, paymentDocument.byteOffset, paymentDocument.byteLength);

  if (!buffer.length) {
    throw new Error("Payment document PDF is empty.");
  }

  if (buffer.subarray(0, PDF_MAGIC_BYTES.length).toString("ascii") !== PDF_MAGIC_BYTES) {
    throw new Error("Payment document PDF has invalid magic bytes.");
  }

  return {
    filename: paymentDocumentFilename(order),
    content: buffer.toString("base64"),
    contentType: "application/pdf",
  };
}

async function defaultPaymentDocumentGenerator(order: OrderForEmail) {
  const { generatePaymentDocumentPdf } = await import("@/lib/order-payment-document");
  return generatePaymentDocumentPdf(order);
}

async function loadPaymentDocumentAttachment(
  order: OrderForEmail,
  generatePaymentDocumentPdf: PaymentDocumentGenerator,
) {
  try {
    const paymentDocument = await generatePaymentDocumentPdf(order);
    return buildPaymentDocumentAttachment(order, paymentDocument);
  } catch (error) {
    const rootError = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack?.slice(0, 2000),
          cause: error.cause instanceof Error
            ? { name: error.cause.name, message: error.cause.message }
            : error.cause ? String(error.cause) : undefined,
        }
      : { name: "NonError", message: String(error) };
    console.error("Payment document PDF attachment failed:", {
      orderId: order.id,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.length,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      error: rootError,
    });
    return undefined;
  }
}

function adminEmails() {
  const configured = process.env.ADMIN_NOTIFICATION_EMAILS
    ?.split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return configured ?? [];
}

function contactRecipientEmails() {
  const configured = process.env.CONTACT_RECIPIENT_EMAILS
    ?.split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return configured?.length ? configured : adminEmails();
}

function emailClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return apiKey ? new Resend(apiKey) : null;
}

const ADDRESS_CATEGORY: Record<
  "CONTACT" | "ORDER_CREATED" | "ORDER_STATUS" | "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "SUPPORT_REPLY",
  TransactionalEmailCategory
> = {
  CONTACT: "support",
  ORDER_CREATED: "order",
  ORDER_STATUS: "order",
  PASSWORD_RESET: "system",
  EMAIL_VERIFICATION: "system",
  SUPPORT_REPLY: "support",
};

function withAutomaticFooter(html: string, replyTo: string, category: TransactionalEmailCategory) {
  const contactPurpose = category === "order"
    ? "въпрос за поръчката"
    : category === "support"
      ? "въпрос за рекламация или обслужване"
      : "общ въпрос";
  const footer = `<div style="max-width:680px;margin:18px auto 0;padding:0 14px 24px;color:#7c6d5c;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;text-align:center">Това е автоматично съобщение. Ако имате ${contactPurpose}, можете да се свържете с нас на <a href="mailto:${escapeHtml(replyTo)}" style="color:#740d38">${escapeHtml(replyTo)}</a>.</div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}${footer}`;
}

function itemsHtml(order: OrderForEmail, admin = false) {
  return order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 10px;border-bottom:1px solid #eadfcd;">
            <strong>${escapeHtml(item.name)}</strong><br>
            <span style="color:#7c6d5c;font-size:13px;">Размер: ${escapeHtml(item.size)}${admin && item.sku ? ` · SKU: ${escapeHtml(item.sku)}` : ""}</span>
          </td>
          <td style="padding:14px 10px;border-bottom:1px solid #eadfcd;text-align:center;">${item.quantity}</td>
          <td style="padding:14px 10px;border-bottom:1px solid #eadfcd;text-align:right;white-space:nowrap;">${money(Number(item.price) * item.quantity)}</td>
        </tr>`,
    )
    .join("");
}

function layout(title: string, intro: string, order: OrderForEmail, admin = false) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  return `<!doctype html>
<html lang="bg">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:#251d18;">
  <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
    <div style="background:#23110d;padding:24px;text-align:center;border-radius:18px 18px 0 0;">
      <div style="font-size:25px;font-weight:800;letter-spacing:2px;color:#f0c979;">${EMAIL_BRAND_NAME_UPPER}</div>
      <div style="margin-top:6px;color:#d9c5b6;font-size:13px;">Онлайн магазин</div>
    </div>
    <div style="background:#fff;padding:30px;border-radius:0 0 18px 18px;box-shadow:0 8px 30px rgba(45,27,18,.08);">
      <h1 style="margin:0 0 12px;font-size:25px;color:#381a12;">${escapeHtml(title)}</h1>
      <p style="font-size:16px;line-height:1.6;color:#59483d;margin:0 0 24px;">${escapeHtml(intro)}</p>

      <div style="background:#fbf6ee;border:1px solid #eadfcd;border-radius:12px;padding:16px;margin-bottom:22px;">
        ${admin ? `<div><strong>Поръчка:</strong> #${order.id}</div>` : ""}
        <div style="${admin ? "margin-top:7px;" : ""}"><strong>Статус:</strong> ${STATUS_LABELS[order.status]}</div>
        <div style="margin-top:7px;"><strong>Дата:</strong> ${new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short" }).format(order.createdAt)}</div>
      </div>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:22px;">
        <thead><tr style="background:#f5ead7;">
          <th style="padding:11px 10px;text-align:left;">Артикул</th>
          <th style="padding:11px 10px;text-align:center;">Брой</th>
          <th style="padding:11px 10px;text-align:right;">Сума</th>
        </tr></thead>
        <tbody>${itemsHtml(order, admin)}</tbody>
      </table>

      <div style="margin-left:auto;max-width:310px;font-size:15px;line-height:1.8;">
        <div style="display:flex;justify-content:space-between;gap:20px;"><span>Артикули:</span><strong>${money(subtotal)}</strong></div>
        ${Number(order.promoDiscount) > 0 ? `<div style="display:flex;justify-content:space-between;gap:20px;color:#247039;"><span>Промокод ${escapeHtml(order.promoCode || "")}:</span><strong>-${money(Number(order.promoDiscount))}</strong></div>` : ""}
        <div style="display:flex;justify-content:space-between;gap:20px;"><span>Доставка:</span><strong>${Number(order.shippingCost) ? money(Number(order.shippingCost)) : "Безплатна"}</strong></div>
        <div style="display:flex;justify-content:space-between;gap:20px;border-top:2px solid #c69645;margin-top:8px;padding-top:8px;font-size:18px;"><span>Общо:</span><strong>${money(Number(order.total))}</strong></div>
      </div>

      <div style="margin-top:26px;padding-top:22px;border-top:1px solid #eadfcd;">
        <h2 style="font-size:18px;margin:0 0 12px;color:#381a12;">Доставка</h2>
        <div style="line-height:1.65;color:#59483d;">
          <strong>${escapeHtml(order.customerName)}</strong><br>
          ${escapeHtml(order.address)}, ${escapeHtml(order.postalCode)} ${escapeHtml(order.city)}<br>
          ${escapeHtml(order.country)}<br>
          ${order.customerPhone ? `Телефон: ${escapeHtml(order.customerPhone)}<br>` : ""}
          Куриер: ${escapeHtml(order.courierProvider === "ECONT" ? "Еконт" : order.courierProvider === "SPEEDY" ? "Спиди" : "—")}<br>
          Метод: ${deliveryLabel(order.deliveryMethod)}${order.courierOfficeName ? ` · ${escapeHtml(order.courierOfficeName)}` : ""}<br>
          Плащане: ${paymentLabel(order.paymentMethod)} · ${escapeHtml(order.paymentStatus)}
          ${order.shipmentNumber ? `<br>Товарителница: ${escapeHtml(order.shipmentNumber)}` : ""}
        </div>
      </div>

      ${order.notes ? `<div style="margin-top:20px;background:#fff9ed;border-left:4px solid #c69645;padding:14px;"><strong>Бележка:</strong><br>${escapeHtml(order.notes)}</div>` : ""}
      ${admin ? `<div style="margin-top:20px;color:#7c6d5c;font-size:13px;">Клиентски имейл: ${escapeHtml(order.customerEmail)}</div>` : ""}
    </div>
  </div>
</body>
</html>`;
}

async function sendSafe(input: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  category: "CONTACT" | "ORDER_CREATED" | "ORDER_STATUS" | "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "SUPPORT_REPLY";
  entityId?: string;
  automaticFooter?: boolean;
  attachments?: SafeEmailAttachment[];
}) {
  const intendedRecipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
  const testMode = process.env.RESEND_TEST_MODE === "true";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
  const recipients = testMode && testRecipient ? [testRecipient] : intendedRecipients;
  const redirected = testMode && Boolean(testRecipient) && intendedRecipients.some((recipient) => recipient !== testRecipient);

  const recordDelivery = async (status: "SENT" | "FAILED" | "SKIPPED", detail?: string, providerId?: string) => {
    try {
      await writeAuditLog({
        action: `EMAIL_${status}`,
        entityType: "EmailDelivery",
        entityId: input.entityId,
        description: `${input.category}: ${status.toLowerCase()} към ${recipients.length} получател(и).`,
        metadata: {
          category: input.category,
          recipients: recipients.length,
          intendedRecipients: intendedRecipients.length,
          testRedirected: redirected,
          subject: input.subject,
          detail,
          providerId,
        },
      });
    } catch (auditError) {
      console.error("Email delivery audit failed:", auditError);
    }
  };

  if (!intendedRecipients.length) {
    await recordDelivery("SKIPPED", "missing-recipient");
    return { sent: false as const, reason: "missing-recipient" };
  }

  let envelope: ReturnType<typeof getTransactionalEmailEnvelope>;
  try {
    envelope = getTransactionalEmailEnvelope(ADDRESS_CATEGORY[input.category]);
  } catch (configurationError) {
    const detail = configurationError instanceof Error ? configurationError.message : "Невалидна адресна конфигурация.";
    console.error("Email configuration error:", detail);
    await recordDelivery("SKIPPED", "invalid-address-config");
    return { sent: false as const, reason: "invalid-address-config" };
  }

  const resend = emailClient();
  if (!resend) {
    console.warn("Имейлът е пропуснат: липсва RESEND_API_KEY.");
    await recordDelivery("SKIPPED", "missing-config");
    return { sent: false as const, reason: "missing-config" };
  }

  try {
    const replyTo = input.replyTo || envelope.replyTo;
    const { data, error } = await resend.emails.send({
      from: envelope.from,
      to: recipients,
      subject: input.subject,
      html: input.automaticFooter && replyTo
        ? withAutomaticFooter(input.html, replyTo, ADDRESS_CATEGORY[input.category])
        : input.html,
      replyTo,
      attachments: input.attachments,
    });

    if (error) {
      console.error("Resend error:", error);
      await recordDelivery("FAILED", "provider-error");
      return { sent: false as const, reason: "provider-error" };
    }

    await recordDelivery("SENT", undefined, data?.id);
    return {
      sent: true as const,
      id: data?.id,
      testRedirected: redirected,
      actualRecipient: recipients[0],
    };
  } catch (error) {
    console.error("Неуспешно изпращане на имейл:", error);
    await recordDelivery("FAILED", error instanceof Error ? error.message.slice(0, 500) : "exception");
    return { sent: false as const, reason: "exception" };
  }
}

function contactMessageLayout(message: ContactMessage) {
  const receivedAt = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date());

  const escapedMessage = escapeHtml(message.message).replaceAll("\n", "<br>");

  return `<!doctype html>
<html lang="bg">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:#251d18;">
  <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
    <div style="background:#23110d;padding:24px;text-align:center;border-radius:18px 18px 0 0;">
      <div style="font-size:25px;font-weight:800;letter-spacing:2px;color:#f0c979;">${EMAIL_BRAND_NAME_UPPER}</div>
      <div style="margin-top:6px;color:#d9c5b6;font-size:13px;">Ново запитване от контактната форма</div>
    </div>
    <div style="background:#fff;padding:30px;border-radius:0 0 18px 18px;box-shadow:0 8px 30px rgba(45,27,18,.08);">
      <h1 style="margin:0 0 20px;font-size:25px;color:#381a12;">${escapeHtml(CONTACT_TOPIC_LABELS[message.topic])}</h1>

      <div style="background:#fbf6ee;border:1px solid #eadfcd;border-radius:12px;padding:18px;margin-bottom:22px;line-height:1.7;">
        <div><strong>Име:</strong> ${escapeHtml(message.name)}</div>
        <div><strong>Имейл:</strong> <a href="mailto:${escapeHtml(message.email)}" style="color:var(--brand-primary);">${escapeHtml(message.email)}</a></div>
        ${message.phone ? `<div><strong>Телефон:</strong> ${escapeHtml(message.phone)}</div>` : ""}
        ${message.orderNumber ? `<div><strong>Поръчка:</strong> ${escapeHtml(message.orderNumber)}</div>` : ""}
        <div><strong>Получено:</strong> ${escapeHtml(receivedAt)}</div>
      </div>

      <div style="line-height:1.7;color:#4f4037;">
        <strong style="display:block;margin-bottom:8px;color:#381a12;">Съобщение</strong>
        ${escapedMessage}
      </div>

      <div style="margin-top:26px;padding-top:18px;border-top:1px solid #eadfcd;color:#7c6d5c;font-size:13px;">
        Натисни „Отговор“, за да пишеш директно на клиента.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendContactMessage(message: ContactMessage) {
  return sendSafe({
    to: contactRecipientEmails(),
    subject: `[Контакт] ${CONTACT_TOPIC_LABELS[message.topic]} · ${message.name}`,
    html: contactMessageLayout(message),
    replyTo: message.email,
    category: "CONTACT",
  });
}

export async function sendNewOrderEmails(
  order: OrderForEmail,
  options: { generatePaymentDocumentPdf?: PaymentDocumentGenerator } = {},
) {
  const paymentDocumentAttachment = await loadPaymentDocumentAttachment(
    order,
    options.generatePaymentDocumentPdf ?? defaultPaymentDocumentGenerator,
  );

  const customer = sendSafe({
    to: order.customerEmail,
    subject: `Получихме поръчката ти | ${EMAIL_BRAND_NAME}`,
    html: layout(
      "Поръчката ти е приета",
      orderCreatedCustomerIntro(Boolean(paymentDocumentAttachment)),
      order,
    ),
    category: "ORDER_CREATED",
    entityId: String(order.id),
    automaticFooter: true,
    attachments: paymentDocumentAttachment ? [paymentDocumentAttachment] : undefined,
  });

  const admins = sendSafe({
    to: adminEmails(),
    subject: `Нова поръчка #${order.id} от ${order.customerName}`,
    html: layout(
      `Нова поръчка #${order.id}`,
      "В магазина е постъпила нова поръчка за обработка.",
      order,
      true,
    ),
    category: "ORDER_CREATED",
    entityId: String(order.id),
  });

  return Promise.allSettled([customer, admins]);
}

export async function sendOrderStatusEmail(order: OrderForEmail) {
  await sendSafe({
    to: order.customerEmail,
    subject: `Поръчката ти е ${STATUS_LABELS[order.status].toLowerCase()} | ${EMAIL_BRAND_NAME}`,
    html: layout(
      `Поръчката ти е ${STATUS_LABELS[order.status].toLowerCase()}`,
      STATUS_MESSAGES[order.status],
      order,
    ),
    category: "ORDER_STATUS",
    entityId: String(order.id),
    automaticFooter: true,
  });
}

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string; expiresAt: Date }) {
  const testMode = process.env.RESEND_TEST_MODE === "true";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
  const actualRecipient = testMode && testRecipient ? testRecipient : input.to;
  const expiry = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(input.expiresAt);
  const html = `<!doctype html><html lang="bg"><body style="margin:0;background:#f4efe8;font-family:Arial,sans-serif;color:#251d18"><div style="max-width:640px;margin:auto;padding:28px 14px"><div style="background:#3b0018;padding:24px;text-align:center;color:#f0c979;font-size:25px;font-weight:800;letter-spacing:2px">${EMAIL_BRAND_NAME_UPPER}</div><div style="background:white;padding:32px"><h1 style="color:#381a12">Смяна на парола</h1><p style="line-height:1.7">Здравей, ${escapeHtml(input.name)}. Получихме заявка за нова парола.</p><p style="text-align:center;margin:30px 0"><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#740d38;color:#f4d77f;padding:16px 26px;text-decoration:none;font-weight:800">Смени паролата</a></p><p style="line-height:1.7;color:#6f5b64">Линкът е еднократен и е валиден до ${escapeHtml(expiry)}. Ако не си поискал промяната, игнорирай този имейл.</p><p style="font-size:12px;word-break:break-all;color:#8b747e">${escapeHtml(input.resetUrl)}</p></div></div></body></html>`;
  const result = await sendSafe({
    to: actualRecipient,
    subject: actualRecipient !== input.to
      ? `ТЕСТ: Възстановяване на парола за ${input.to} | ${EMAIL_BRAND_NAME}`
      : `Възстановяване на парола | ${EMAIL_BRAND_NAME}`,
    html,
    category: "PASSWORD_RESET",
    entityId: input.to,
    automaticFooter: true,
  });

  return {
    ...result,
    testRedirected: actualRecipient !== input.to,
    actualRecipient,
  };
}


export async function sendEmailVerificationCode(input: { to: string; name: string; code: string; expiresAt: Date }) {
  const testMode = process.env.RESEND_TEST_MODE === "true";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
  const actualRecipient = testMode && testRecipient ? testRecipient : input.to;
  const expiry = new Intl.DateTimeFormat("bg-BG", { timeStyle: "short", timeZone: "Europe/Sofia" }).format(input.expiresAt);
  const html = `<!doctype html><html lang="bg"><body style="margin:0;background:#f4efe8;font-family:Arial,sans-serif;color:#251d18"><div style="max-width:640px;margin:auto;padding:28px 14px"><div style="background:#3b0018;padding:24px;text-align:center;color:#f0c979;font-size:25px;font-weight:800;letter-spacing:2px">${EMAIL_BRAND_NAME_UPPER}</div><div style="background:white;padding:32px"><h1 style="color:#381a12">Потвърди профила си</h1><p style="line-height:1.7">Здравей, ${escapeHtml(input.name)}. Въведи този код в сайта:</p><div style="margin:28px 0;text-align:center;font-size:38px;font-weight:900;letter-spacing:10px;color:#740d38">${escapeHtml(input.code)}</div><p style="line-height:1.7;color:#6f5b64">Кодът е валиден до ${escapeHtml(expiry)} и може да се използва само веднъж.</p></div></div></body></html>`;
  const result = await sendSafe({
    to: actualRecipient,
    subject: actualRecipient !== input.to ? `ТЕСТ: Код за ${input.to} | ${EMAIL_BRAND_NAME}` : `Код за потвърждение | ${EMAIL_BRAND_NAME}`,
    html,
    category: "EMAIL_VERIFICATION",
    entityId: input.to,
    automaticFooter: true,
  });
  return { ...result, testRedirected: actualRecipient !== input.to, actualRecipient };
}


export async function sendSupportReplyEmail(input: {
  to: string;
  customerName: string;
  reference: string;
  subject: string;
  message: string;
}) {
  const safeMessage = escapeHtml(input.message).replaceAll("\n", "<br>");
  const html = `<!doctype html><html lang="bg"><body style="margin:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:#251d18"><div style="max-width:680px;margin:0 auto;padding:28px 14px"><div style="background:#3b0018;padding:24px;text-align:center;border-radius:18px 18px 0 0"><div style="font-size:25px;font-weight:800;letter-spacing:2px;color:#f0c979">${EMAIL_BRAND_NAME_UPPER}</div><div style="margin-top:6px;color:#d9c5b6;font-size:13px">Отговор от обслужване на клиенти</div></div><div style="background:#fff;padding:30px;border-radius:0 0 18px 18px;box-shadow:0 8px 30px rgba(45,27,18,.08)"><h1 style="margin:0 0 12px;font-size:24px;color:#381a12">Получихте нов отговор</h1><p style="font-size:16px;line-height:1.7;color:#59483d">Здравейте, ${escapeHtml(input.customerName)}.</p><div style="background:#fbf6ee;border:1px solid #eadfcd;border-radius:12px;padding:16px;margin:18px 0"><div><strong>Сигнал:</strong> ${escapeHtml(input.reference)}</div><div style="margin-top:7px"><strong>Тема:</strong> ${escapeHtml(input.subject)}</div></div><div style="line-height:1.75;color:#4f4037">${safeMessage}</div><div style="margin-top:24px;padding-top:18px;border-top:1px solid #eadfcd;color:#7c6d5c;font-size:13px">Отговорът е записан и в профила Ви в секцията „Моите сигнали“. Можете да продължите разговора директно в сайта.</div></div></div></body></html>`;
  return sendSafe({
    to: input.to,
    subject: `Нов отговор по ${input.reference} | ${EMAIL_BRAND_NAME}`,
    html,
    category: "SUPPORT_REPLY",
    entityId: input.reference,
    automaticFooter: true,
  });
}
