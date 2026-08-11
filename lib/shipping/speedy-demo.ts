import type { CreatedShipment, ShipmentRequest, ShipmentTracking, ShippingOffice, ShippingQuote } from "@/lib/shipping/types";

const DEMO_OFFICES: ShippingOffice[] = [
  { provider: "SPEEDY", id: "990001", name: "Спиди офис София — Център (ТЕСТ)", address: "бул. Княз Александър Дондуков 10", city: "София", postalCode: "1000", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990002", name: "Спиди офис София — Младост (ТЕСТ)", address: "ж.к. Младост 1, бл. 39", city: "София", postalCode: "1784", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990003", name: "Speedy автомат София — Студентски град (ТЕСТ)", address: "ул. Акад. Борис Стефанов 6", city: "София", postalCode: "1700", type: "LOCKER", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990004", name: "Спиди офис Пловдив — Център (ТЕСТ)", address: "ул. Райко Даскалов 25", city: "Пловдив", postalCode: "4000", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990005", name: "Speedy автомат Пловдив — Тракия (ТЕСТ)", address: "ж.к. Тракия, бл. 15", city: "Пловдив", postalCode: "4023", type: "LOCKER", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990006", name: "Спиди офис Варна — Център (ТЕСТ)", address: "бул. Мария Луиза 18", city: "Варна", postalCode: "9000", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990007", name: "Спиди офис Бургас — Център (ТЕСТ)", address: "ул. Александровска 48", city: "Бургас", postalCode: "8000", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990008", name: "Спиди офис Русе — Център (ТЕСТ)", address: "ул. Александровска 82", city: "Русе", postalCode: "7000", type: "OFFICE", cardPaymentAllowed: true },
  { provider: "SPEEDY", id: "990009", name: "Спиди офис Стара Загора (ТЕСТ)", address: "бул. Цар Симеон Велики 105", city: "Стара Загора", postalCode: "6000", type: "OFFICE", cardPaymentAllowed: false },
  { provider: "SPEEDY", id: "990010", name: "Спиди офис Плевен — Център (ТЕСТ)", address: "ул. Дойран 12", city: "Плевен", postalCode: "5800", type: "OFFICE", cardPaymentAllowed: true },
];

const normalized = (value: string) => value.trim().toLocaleLowerCase("bg-BG");

export function listSpeedyDemoOffices(query = "", city = "") {
  const terms = normalized(`${query} ${city}`).split(/\s+/).filter(Boolean);
  return DEMO_OFFICES.filter((office) => {
    const text = normalized(`${office.name} ${office.address} ${office.city} ${office.postalCode}`);
    return terms.every((term) => text.includes(term));
  });
}

export function getSpeedyDemoOffice(id: string) {
  return DEMO_OFFICES.find((office) => office.id === id) ?? null;
}

function nextBusinessDate(days: number) {
  const date = new Date();
  while (days > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days -= 1;
  }
  return date.toISOString().slice(0, 10);
}

export function quoteSpeedyDemo(request: ShipmentRequest): ShippingQuote {
  const office = request.deliveryMethod === "OFFICE";
  const locker = office && request.office?.type === "LOCKER";
  const base = locker ? 4.5 : office ? 4.9 : 6.2;
  const weightCharge = Math.max(0, Math.ceil(request.weightKg) - 1) * 0.8;
  const codCharge = request.paymentMethod === "CASH_ON_DELIVERY" ? 0.5 : 0;
  const amount = Math.round((base + weightCharge + codCharge) * 100) / 100;
  return {
    provider: "SPEEDY",
    amount,
    currency: "EUR",
    originalAmount: amount,
    originalCurrency: "EUR",
    expectedDeliveryDate: nextBusinessDate(2),
    serviceId: "505",
    source: "DEMO",
  };
}

export function createSpeedyDemoShipment(request: ShipmentRequest): CreatedShipment {
  const suffix = `${request.orderId}-${Date.now().toString(36)}`.toUpperCase();
  return {
    shipmentNumber: `SPD-DEMO-${suffix}`,
    status: "DEMO",
    expectedDeliveryDate: nextBusinessDate(2),
  };
}

function pdfEscape(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

export function getSpeedyDemoLabelPdf(parcelId: string) {
  const lines = [
    "SPEEDY DEMO LABEL",
    "NOT A REAL SHIPMENT",
    `Parcel: ${pdfEscape(parcelId)}`,
    `Created: ${new Date().toISOString().slice(0, 10)}`,
    "Environment: ONLINE STORE QA",
  ];
  const commands: string[] = ["BT", "/F1 18 Tf", "28 370 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -42 Td");
    commands.push(`(${line}) Tj`);
  });
  commands.push("ET", "0.8 w 20 20 258 380 re S");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 298 420] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(pdf, "utf8")).buffer;
}

export function trackSpeedyDemoShipment(shipmentNumber: string): ShipmentTracking {
  const checkedAt = new Date().toISOString();
  return {
    provider: "SPEEDY",
    shipmentNumber,
    status: "Тестова товарителница — подготвена за изпращане",
    delivered: false,
    checkedAt,
    events: [{
      code: "DEMO",
      description: "Тестовата пратка е създадена успешно",
      location: "Демо среда на Спиди",
      occurredAt: checkedAt,
    }],
  };
}
