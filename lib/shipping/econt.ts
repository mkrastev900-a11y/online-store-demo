import { firstText, positiveNumber, postJson } from "@/lib/shipping/http";
import type { CreatedShipment, ShipmentRequest, ShipmentTracking, ShippingAddress, ShippingOffice, ShippingQuote } from "@/lib/shipping/types";

type EcontOffice = {
  id?: number | string;
  code?: string;
  name?: string;
  nameEn?: string;
  isAPS?: boolean;
  address?: {
    fullAddress?: string;
    postCode?: string;
    city?: { name?: string; postCode?: string };
  };
};

type EcontLabelResponse = {
  label?: {
    totalPrice?: number;
    currency?: string;
    shipmentNumber?: string;
    pdfURL?: string;
    expectedDeliveryDate?: string;
    shortDeliveryStatus?: string;
    error?: { message?: string };
  };
};

type EcontTrackingStatus = {
  shipmentNumber?: string;
  deliveryTime?: string;
  shortDeliveryStatus?: string;
  trackingEvents?: Array<{
    destinationDetails?: string;
    officeName?: string;
    cityName?: string;
    time?: string;
  }>;
};

type EcontTrackingResponse = {
  shipmentStatuses?: Array<{
    status?: EcontTrackingStatus;
    error?: { message?: string };
  }>;
};

let officeCache: { expiresAt: number; offices: ShippingOffice[] } | null = null;

const environment = () => process.env.ECONT_ENV === "production" ? "production" : "demo";
const baseUrl = () => environment() === "production" ? "https://ee.econt.com/services" : "https://demo.econt.com/ee/services";
const credentials = () => ({
  username: process.env.ECONT_USERNAME || (environment() === "demo" ? "iasp-dev" : ""),
  password: process.env.ECONT_PASSWORD || (environment() === "demo" ? "1Asp-dev" : ""),
});

export function isEcontDemo() {
  return environment() === "demo";
}

export function isEcontConfigured() {
  const auth = credentials();
  return Boolean(auth.username && auth.password);
}

function headers() {
  const auth = credentials();
  if (!auth.username || !auth.password) throw new Error("Липсват ECONT_USERNAME и ECONT_PASSWORD.");
  return { Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}` };
}

function mapOffice(office: EcontOffice): ShippingOffice | null {
  const id = String(office.id ?? office.code ?? "").trim();
  if (!id) return null;
  const city = firstText(office.address?.city?.name);
  const address = firstText(office.address?.fullAddress, [city, office.address?.postCode].filter(Boolean).join(" "));
  return {
    provider: "ECONT",
    id,
    code: firstText(office.code) || undefined,
    name: firstText(office.name, office.nameEn, `Офис ${office.code ?? id}`),
    address,
    city,
    postalCode: firstText(office.address?.postCode, office.address?.city?.postCode),
    type: office.isAPS ? "LOCKER" : "OFFICE",
    cardPaymentAllowed: true,
  };
}

async function allEcontOffices() {
  if (officeCache && officeCache.expiresAt > Date.now()) return officeCache.offices;
  const response = await postJson<{ offices?: EcontOffice[] }>(
    `${baseUrl()}/Nomenclatures/NomenclaturesService.getOffices.json`,
    { countryCode: "BGR" },
    headers(),
  );
  const offices = (response.offices ?? []).map(mapOffice).filter((office): office is ShippingOffice => Boolean(office));
  officeCache = { expiresAt: Date.now() + 5 * 60 * 1000, offices };
  return offices;
}

export async function listEcontOffices(query = "", city = "") {
  const terms = `${query} ${city}`.trim().toLocaleLowerCase("bg-BG").split(/\s+/).filter(Boolean);
  return (await allEcontOffices())
    .filter((office) => {
      const text = `${office.name} ${office.address} ${office.city} ${office.postalCode} ${office.code ?? ""}`.toLocaleLowerCase("bg-BG");
      return terms.every((term) => text.includes(term));
    })
    .slice(0, 40);
}

export async function getEcontOffice(id: string) {
  const offices = await allEcontOffices();
  return offices.find((office) => office.id === id || office.code === id) ?? null;
}

function splitStreet(address: string) {
  const value = address.trim();
  const match = value.match(/^(.*?)[,\s]+(?:№\s*)?(\d+[a-zA-Zа-яА-Я-]*)\s*$/u);
  return match ? { street: match[1].trim(), num: match[2].trim() } : { street: value, num: "1" };
}

function econtAddress(address: ShippingAddress) {
  const street = splitStreet(address.address);
  return {
    city: { country: { code3: "BGR" }, name: address.city, postCode: address.postalCode },
    street: street.street,
    num: street.num,
    other: address.addressLine2 || undefined,
  };
}

function sender() {
  const senderOfficeCode = process.env.ECONT_SENDER_OFFICE_CODE?.trim();
  const demo = isEcontDemo();
  const senderName = process.env.ECONT_SENDER_NAME?.trim() || (demo ? "Online Store Demo" : "");
  const senderPhone = process.env.ECONT_SENDER_PHONE?.trim() || (demo ? "0888123456" : "");

  if (!senderName || !senderPhone) {
    throw new Error("За production Еконт попълни ECONT_SENDER_NAME и ECONT_SENDER_PHONE.");
  }

  if (senderOfficeCode) {
    return {
      senderClient: { name: senderName, phones: [senderPhone] },
      senderOfficeCode,
    };
  }

  const city = process.env.ECONT_SENDER_CITY?.trim() || (demo ? "София" : "");
  const postCode = process.env.ECONT_SENDER_POST_CODE?.trim() || (demo ? "1000" : "");
  const street = process.env.ECONT_SENDER_STREET?.trim() || (demo ? "Княз Александър I" : "");
  const num = process.env.ECONT_SENDER_STREET_NUMBER?.trim() || (demo ? "1" : "");

  if (!city || !postCode || !street || !num) {
    throw new Error("За production Еконт задай ECONT_SENDER_OFFICE_CODE или пълния адрес на подателя.");
  }

  return {
    senderClient: { name: senderName, phones: [senderPhone] },
    senderAddress: {
      city: { country: { code3: "BGR" }, name: city, postCode },
      street,
      num,
    },
  };
}

function label(request: ShipmentRequest) {
  const officeCode = request.office?.code || request.office?.id;
  return {
    ...sender(),
    receiverClient: { name: request.customerName, phones: [request.customerPhone], email: request.customerEmail },
    ...(request.deliveryMethod === "OFFICE" ? { receiverOfficeCode: officeCode } : { receiverAddress: econtAddress(request) }),
    packCount: 1,
    shipmentType: "PACK",
    weight: request.weightKg,
    shipmentDescription: request.description,
    services: request.paymentMethod === "CASH_ON_DELIVERY" ? {
      cdAmount: request.amountToCollect,
      cdType: "GET",
      cdCurrency: "EUR",
    } : undefined,
    payAfterAccept: false,
    payAfterTest: false,
  };
}

function ensureLabel(response: EcontLabelResponse) {
  if (response.label?.error?.message) throw new Error(response.label.error.message);
  if (!response.label) throw new Error("Еконт не върна данни за пратката.");
  return response.label;
}

export async function quoteEcont(request: ShipmentRequest): Promise<ShippingQuote> {
  const response = await postJson<EcontLabelResponse>(
    `${baseUrl()}/Shipments/LabelService.createLabel.json`,
    { label: label(request), mode: "calculate" },
    headers(),
  );
  const result = ensureLabel(response);
  const amount = positiveNumber(result.totalPrice);
  if (amount === null) throw new Error("Еконт не върна цена за доставката.");
  return {
    provider: "ECONT",
    amount,
    currency: "EUR",
    originalAmount: amount,
    originalCurrency: firstText(result.currency, "EUR"),
    expectedDeliveryDate: result.expectedDeliveryDate,
    source: isEcontDemo() ? "DEMO" : "LIVE",
  };
}

export async function createEcontShipment(request: ShipmentRequest): Promise<CreatedShipment> {
  const response = await postJson<EcontLabelResponse>(
    `${baseUrl()}/Shipments/LabelService.createLabel.json`,
    { label: label(request), mode: "create" },
    headers(),
  );
  const result = ensureLabel(response);
  if (!result.shipmentNumber) throw new Error("Еконт не върна номер на товарителница.");
  return {
    shipmentNumber: result.shipmentNumber,
    labelUrl: result.pdfURL,
    status: result.shortDeliveryStatus || "CREATED",
    expectedDeliveryDate: result.expectedDeliveryDate,
  };
}

export async function trackEcontShipment(shipmentNumber: string): Promise<ShipmentTracking> {
  const response = await postJson<EcontTrackingResponse>(
    `${baseUrl()}/Shipments/ShipmentService.getShipmentStatuses.json`,
    { shipmentNumbers: [shipmentNumber] },
    headers(),
  );
  const result = response.shipmentStatuses?.[0];
  if (result?.error?.message) throw new Error(result.error.message);
  if (!result?.status) throw new Error("Еконт не върна информация за проследяване.");

  const events = (result.status.trackingEvents ?? [])
    .filter((event) => Boolean(event.time))
    .map((event) => ({
      description: firstText(event.destinationDetails, result.status?.shortDeliveryStatus, "Движение на пратката"),
      location: firstText(event.officeName, event.cityName) || undefined,
      occurredAt: String(event.time),
    }))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return {
    provider: "ECONT",
    shipmentNumber,
    status: firstText(result.status.shortDeliveryStatus, events[0]?.description, "Товарителницата е създадена"),
    delivered: Boolean(result.status.deliveryTime),
    checkedAt: new Date().toISOString(),
    events,
  };
}
