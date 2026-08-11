import { firstText, positiveNumber, postJson } from "@/lib/shipping/http";
import { createSpeedyDemoShipment, getSpeedyDemoLabelPdf, getSpeedyDemoOffice, listSpeedyDemoOffices, quoteSpeedyDemo, trackSpeedyDemoShipment } from "@/lib/shipping/speedy-demo";
import type { CreatedShipment, ShipmentRequest, ShipmentTracking, ShippingOffice, ShippingQuote } from "@/lib/shipping/types";

type SpeedyOffice = {
  id?: number;
  name?: string;
  type?: string;
  cardPaymentAllowed?: boolean;
  address?: { fullAddressString?: string; postCode?: string; siteName?: string };
};

type SpeedyPriceResponse = {
  calculations?: Array<{
    price?: { total?: number; currency?: string };
    deliveryDeadline?: string;
    serviceId?: number;
    error?: { message?: string };
  }>;
  price?: { total?: number; currency?: string };
  deliveryDeadline?: string;
  serviceId?: number;
};

type SpeedyShipmentResponse = {
  id?: string | number;
  parcels?: Array<{ id?: string | number }>;
  price?: { total?: number; currency?: string };
  deliveryDeadline?: string;
};

type SpeedyTrackingResponse = {
  parcels?: Array<{
    parcelId?: string;
    operations?: Array<{
      dateTime?: string;
      operationCode?: number;
      place?: string;
      description?: string;
      comment?: string;
    }>;
    error?: { message?: string };
  }>;
  error?: { message?: string };
};

const baseUrl = () => "https://api.speedy.bg/v1";
const credentials = () => ({ userName: process.env.SPEEDY_USERNAME?.trim() || "", password: process.env.SPEEDY_PASSWORD?.trim() || "" });

export function isSpeedyDemo() {
  return process.env.SPEEDY_ENV === "demo";
}

export function isSpeedyConfigured() {
  if (isSpeedyDemo()) return true;
  const auth = credentials();
  return Boolean(auth.userName && auth.password);
}

function auth() {
  const value = credentials();
  if (!value.userName || !value.password) throw new Error("Липсват SPEEDY_USERNAME и SPEEDY_PASSWORD.");
  return value;
}

function mapOffice(office: SpeedyOffice): ShippingOffice | null {
  if (!office.id) return null;
  return {
    provider: "SPEEDY",
    id: String(office.id),
    name: firstText(office.name, `Офис ${office.id}`),
    address: firstText(office.address?.fullAddressString),
    city: firstText(office.address?.siteName),
    postalCode: firstText(office.address?.postCode),
    type: String(office.type || "").toUpperCase().includes("APT") ? "LOCKER" : "OFFICE",
    cardPaymentAllowed: office.cardPaymentAllowed,
  };
}

export async function listSpeedyOffices(query = "", city = "") {
  if (isSpeedyDemo()) return listSpeedyDemoOffices(query, city);
  const response = await postJson<{ offices?: SpeedyOffice[] }>(`${baseUrl()}/location/office`, {
    ...auth(),
    countryId: 100,
    siteName: city || undefined,
    name: query || undefined,
    limit: 40,
  });
  return (response.offices ?? []).map(mapOffice).filter((office): office is ShippingOffice => Boolean(office));
}

export async function getSpeedyOffice(id: string) {
  if (isSpeedyDemo()) return getSpeedyDemoOffice(id);
  const response = await postJson<{ office?: SpeedyOffice }>(`${baseUrl()}/location/office/${encodeURIComponent(id)}`, auth());
  return response.office ? mapOffice(response.office) : null;
}

function cod(request: ShipmentRequest) {
  return request.paymentMethod === "CASH_ON_DELIVERY" ? {
    cod: { amount: request.amountToCollect, currencyCode: "EUR", processingType: "POSTAL_MONEY_TRANSFER", cardPaymentForbidden: false },
  } : undefined;
}

function speedyShipmentRequest(request: ShipmentRequest) {
  const senderClientId = Number(process.env.SPEEDY_SENDER_CLIENT_ID);
  const serviceId = Number(request.serviceId || process.env.SPEEDY_SERVICE_ID || 505);
  return {
    ...auth(),
    ...(Number.isInteger(senderClientId) && senderClientId > 0 ? { sender: { clientId: senderClientId } } : {}),
    recipient: {
      privatePerson: true,
      clientName: request.customerName,
      email: request.customerEmail,
      phone1: { number: request.customerPhone },
      ...(request.deliveryMethod === "OFFICE"
        ? { pickupOfficeId: Number(request.office?.id) }
        : { address: { countryId: 100, siteName: request.city, postCode: request.postalCode, addressNote: [request.address, request.addressLine2].filter(Boolean).join(", ") } }),
    },
    service: {
      autoAdjustPickupDate: true,
      serviceId,
      additionalServices: cod(request),
    },
    content: { parcelsCount: 1, contents: request.description, package: "BOX", totalWeight: request.weightKg },
    payment: { courierServicePayer: "SENDER" },
    ref1: `ORDER-${request.orderId}`,
  };
}

function speedyCalculationRequest(request: ShipmentRequest) {
  const senderClientId = Number(process.env.SPEEDY_SENDER_CLIENT_ID);
  const serviceId = Number(request.serviceId || process.env.SPEEDY_SERVICE_ID || 505);
  return {
    ...auth(),
    ...(Number.isInteger(senderClientId) && senderClientId > 0 ? { sender: { clientId: senderClientId } } : {}),
    recipient: {
      privatePerson: true,
      ...(request.deliveryMethod === "OFFICE"
        ? { pickupOfficeId: Number(request.office?.id) }
        : { addressLocation: { countryId: 100, siteName: request.city, postCode: request.postalCode } }),
    },
    service: { autoAdjustPickupDate: true, serviceIds: [serviceId], additionalServices: cod(request) },
    content: { parcelsCount: 1, totalWeight: request.weightKg },
    payment: { courierServicePayer: "SENDER" },
  };
}

export async function quoteSpeedy(request: ShipmentRequest): Promise<ShippingQuote> {
  if (isSpeedyDemo()) return quoteSpeedyDemo(request);
  const response = await postJson<SpeedyPriceResponse>(`${baseUrl()}/calculate`, speedyCalculationRequest(request));
  const calculation = response.calculations?.[0] ?? response;
  if ("error" in calculation && calculation.error?.message) throw new Error(calculation.error.message);
  const amount = positiveNumber(calculation.price?.total);
  if (amount === null) throw new Error("Спиди не върна цена за доставката.");
  return {
    provider: "SPEEDY",
    amount,
    currency: "EUR",
    originalAmount: amount,
    originalCurrency: firstText(calculation.price?.currency, "EUR"),
    expectedDeliveryDate: calculation.deliveryDeadline,
    serviceId: calculation.serviceId ? String(calculation.serviceId) : process.env.SPEEDY_SERVICE_ID || "505",
    source: "LIVE",
  };
}

export async function createSpeedyShipment(request: ShipmentRequest): Promise<CreatedShipment> {
  if (isSpeedyDemo()) return createSpeedyDemoShipment(request);
  const response = await postJson<SpeedyShipmentResponse>(`${baseUrl()}/shipment`, speedyShipmentRequest(request));
  const shipmentNumber = String(response.parcels?.[0]?.id ?? response.id ?? "").trim();
  if (!shipmentNumber) throw new Error("Спиди не върна номер на товарителница.");
  return { shipmentNumber, status: "CREATED", expectedDeliveryDate: response.deliveryDeadline };
}

export async function getSpeedyLabelPdf(parcelId: string) {
  if (isSpeedyDemo()) return getSpeedyDemoLabelPdf(parcelId);
  const response = await fetch(`${baseUrl()}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/pdf, application/json" },
    body: JSON.stringify({ ...auth(), format: "pdf", paperSize: "A6", parcels: [{ parcel: { id: parcelId } }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/pdf")) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Спиди не върна PDF етикет${detail ? `: ${detail}` : "."}`);
  }
  return response.arrayBuffer();
}

export async function trackSpeedyShipment(shipmentNumber: string): Promise<ShipmentTracking> {
  if (isSpeedyDemo()) return trackSpeedyDemoShipment(shipmentNumber);
  const response = await postJson<SpeedyTrackingResponse>(`${baseUrl()}/track`, {
    ...auth(),
    language: "BG",
    parcels: [{ id: shipmentNumber }],
    lastOperationOnly: true,
  });
  if (response.error?.message) throw new Error(response.error.message);
  const parcel = response.parcels?.[0];
  if (parcel?.error?.message) throw new Error(parcel.error.message);
  if (!parcel) throw new Error("Спиди не върна информация за проследяване.");

  const events = (parcel.operations ?? [])
    .filter((operation) => Boolean(operation.dateTime))
    .map((operation) => ({
      code: operation.operationCode === undefined ? undefined : String(operation.operationCode),
      description: firstText(operation.description, operation.comment, "Движение на пратката"),
      location: firstText(operation.place) || undefined,
      occurredAt: String(operation.dateTime),
    }))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return {
    provider: "SPEEDY",
    shipmentNumber,
    status: events[0]?.description || "Товарителницата е създадена",
    delivered: events.some((event) => event.code === "-14"),
    checkedAt: new Date().toISOString(),
    events,
  };
}
