import { createHmac, timingSafeEqual } from "node:crypto";

export type EpayNotification = {
  invoice: number;
  status: "PAID" | "DENIED" | "EXPIRED";
  payTime?: string;
  stan?: string;
  bcode?: string;
};

export function isEpayConfigured() {
  return Boolean(process.env.EPAY_MIN?.trim() && process.env.EPAY_SECRET?.trim());
}

function secret() {
  const value = process.env.EPAY_SECRET?.trim();
  if (!value) throw new Error("Липсва EPAY_SECRET.");
  return value;
}

export function epayEndpoint() {
  return process.env.EPAY_ENV === "production" ? "https://www.epay.bg/" : "https://demo.epay.bg/";
}

function checksum(encoded: string) {
  return createHmac("sha1", secret()).update(encoded).digest("hex");
}

function expiration(hours = 24) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createEpayPayment(order: { id: number; total: unknown }) {
  const min = process.env.EPAY_MIN?.trim();
  if (!min || !isEpayConfigured()) throw new Error("Плащането с карта още не е конфигурирано.");
  const storeName = process.env.STORE_NAME?.trim() || process.env.EMAIL_BRAND_NAME?.trim() || "Online Store";
  const payload = [
    `MIN=${min}`,
    `INVOICE=${order.id}`,
    `AMOUNT=${Number(order.total).toFixed(2)}`,
    "CURRENCY=EUR",
    `EXP_TIME=${expiration()}`,
    `DESCR=Поръчка ${order.id} от ${storeName}`,
    "ENCODING=utf-8",
  ].join("\n");
  const encoded = Buffer.from(payload, "utf8").toString("base64");
  return { endpoint: epayEndpoint(), encoded, checksum: checksum(encoded) };
}

export function verifyEpayNotification(encoded: string, receivedChecksum: string) {
  if (!encoded || !receivedChecksum || !/^[a-f0-9]{40}$/i.test(receivedChecksum)) return false;
  const expected = Buffer.from(checksum(encoded), "hex");
  const received = Buffer.from(receivedChecksum, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseEpayNotifications(encoded: string): EpayNotification[] {
  let decoded = "";
  try { decoded = Buffer.from(encoded, "base64").toString("utf8"); } catch { return []; }

  // ePay may send more than one INVOICE in a single notification. Treat each
  // INVOICE=... segment as an independent record instead of relying only on EOL.
  const chunks = decoded
    .split(/(?=INVOICE=)/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const fields = Object.fromEntries(chunk.split(":").map((part) => {
      const separator = part.indexOf("=");
      return separator < 1 ? [part.trim(), ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }));
    const invoice = Number(fields.INVOICE);
    const status = fields.STATUS;
    if (!Number.isInteger(invoice) || invoice <= 0 || !["PAID", "DENIED", "EXPIRED"].includes(status)) return null;
    return { invoice, status, payTime: fields.PAY_TIME, stan: fields.STAN, bcode: fields.BCODE } as EpayNotification;
  }).filter((item): item is EpayNotification => Boolean(item));
}

export function paymentPageHtml(payment: ReturnType<typeof createEpayPayment>, orderId: number, appUrl: string) {
  const safe = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const ok = `${appUrl}/order-success?order=${orderId}&payment=pending`;
  const cancel = `${appUrl}/checkout?payment=cancelled`;
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Пренасочване към ePay.bg</title><style>body{margin:0;background:#fff9f6;color:#3a1421;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center}.card{padding:40px;max-width:520px;text-align:center;background:white;border:1px solid #eadce2}.spinner{width:38px;height:38px;border:4px solid #eadce2;border-top-color:var(--brand-primary);border-radius:50%;animation:s 1s linear infinite;margin:0 auto 22px}@keyframes s{to{transform:rotate(360deg)}}button{padding:12px 22px;background:var(--brand-primary);color:#f5d57c;border:0;font-weight:700}</style></head><body><div class="card"><div class="spinner"></div><h1>Отваряме защитеното плащане</h1><p>Ще бъдеш пренасочен към ePay.bg.</p><form id="epay" method="post" action="${safe(payment.endpoint)}"><input type="hidden" name="PAGE" value="credit_paydirect"><input type="hidden" name="ENCODED" value="${safe(payment.encoded)}"><input type="hidden" name="CHECKSUM" value="${safe(payment.checksum)}"><input type="hidden" name="URL_OK" value="${safe(ok)}"><input type="hidden" name="URL_CANCEL" value="${safe(cancel)}"><input type="hidden" name="LANG" value="bg"><button type="submit">Продължи към плащане</button></form></div><script>document.getElementById("epay").submit()</script></body></html>`;
}
