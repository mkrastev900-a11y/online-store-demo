import { createEcontShipment, getEcontOffice, isEcontConfigured, isEcontDemo, listEcontOffices, quoteEcont, trackEcontShipment } from "@/lib/shipping/econt";
import { createSpeedyShipment, getSpeedyOffice, isSpeedyConfigured, isSpeedyDemo, listSpeedyOffices, quoteSpeedy, trackSpeedyShipment } from "@/lib/shipping/speedy";
import type { CheckoutShippingInput, CourierProvider, CreatedShipment, PreparedShipping, ShipmentRequest, ShipmentTracking, ShippingOffice, ShippingQuote } from "@/lib/shipping/types";

const BGN_PER_EUR = 1.95583;

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function shippingConfig() {
  return {
    providers: {
      ECONT: { configured: isEcontConfigured(), demo: isEcontDemo(), label: "Еконт" },
      SPEEDY: { configured: isSpeedyConfigured(), demo: isSpeedyDemo(), label: "Спиди" },
    },
    cardPaymentEnabled: Boolean(process.env.EPAY_MIN?.trim() && process.env.EPAY_SECRET?.trim()),
    fallbackEnabled: process.env.SHIPPING_FALLBACK_ENABLED === "true",
    freeThreshold: numberFromEnv("SHIPPING_FREE_THRESHOLD_EUR", 120),
  };
}

export function isCourierProvider(value: unknown): value is CourierProvider {
  return value === "ECONT" || value === "SPEEDY";
}

export async function listCourierOffices(provider: CourierProvider, query = "", city = "") {
  return provider === "ECONT" ? listEcontOffices(query, city) : listSpeedyOffices(query, city);
}

export async function resolveCourierOffice(provider: CourierProvider, id: string) {
  const office = provider === "ECONT" ? await getEcontOffice(id) : await getSpeedyOffice(id);
  if (!office) throw new Error("Избраният офис не беше намерен. Потърси и го избери отново.");
  return office;
}

function normalizedQuote(quote: ShippingQuote): ShippingQuote {
  if (quote.originalCurrency.toUpperCase() !== "BGN") return { ...quote, amount: Math.round(quote.amount * 100) / 100, currency: "EUR" };
  return { ...quote, amount: Math.round((quote.originalAmount / BGN_PER_EUR) * 100) / 100, currency: "EUR" };
}

function fallbackQuote(provider: CourierProvider, warning: string): ShippingQuote {
  const amount = numberFromEnv("SHIPPING_FALLBACK_PRICE_EUR", 7);
  return { provider, amount, currency: "EUR", originalAmount: amount, originalCurrency: "EUR", source: "FALLBACK", warning };
}

export async function prepareShipping(input: CheckoutShippingInput, subtotal: number): Promise<PreparedShipping> {
  if (!isCourierProvider(input.courierProvider)) throw new Error("Избери Еконт или Спиди.");
  if (input.deliveryMethod !== "ADDRESS" && input.deliveryMethod !== "OFFICE") throw new Error("Избери доставка до адрес или офис.");
  if (input.deliveryMethod === "ADDRESS" && (!input.address.trim() || !input.city.trim() || !input.postalCode.trim())) {
    throw new Error("Попълни адрес, град и пощенски код за доставката.");
  }

  let office: ShippingOffice | undefined;
  if (input.deliveryMethod === "OFFICE") {
    if (!input.officeId?.trim()) throw new Error("Потърси и избери офис на куриера.");
    try {
      office = await resolveCourierOffice(input.courierProvider, input.officeId.trim());
    } catch (error) {
      if (process.env.SHIPPING_FALLBACK_ENABLED !== "true") throw error;
      office = {
        provider: input.courierProvider,
        id: input.officeId.trim(),
        name: "Избран офис",
        address: input.address.trim(),
        city: input.city.trim(),
        postalCode: input.postalCode.trim(),
        type: "OFFICE",
      };
    }
  }

  const request: ShipmentRequest = {
    ...input,
    orderId: 0,
    office,
    amountToCollect: subtotal,
    weightKg: numberFromEnv("DEFAULT_SHIPMENT_WEIGHT_KG", 0.5),
    description: "Дрехи и аксесоари",
  };

  let quote: ShippingQuote;
  try {
    const configured = input.courierProvider === "ECONT" ? isEcontConfigured() : isSpeedyConfigured();
    if (!configured) throw new Error(`${input.courierProvider === "ECONT" ? "Еконт" : "Спиди"} API още не е конфигурирано.`);
    quote = normalizedQuote(input.courierProvider === "ECONT" ? await quoteEcont(request) : await quoteSpeedy(request));
  } catch (error) {
    if (process.env.SHIPPING_FALLBACK_ENABLED !== "true") throw error;
    quote = fallbackQuote(input.courierProvider, error instanceof Error ? error.message : "Временен проблем с куриерската услуга.");
  }

  const freeThreshold = numberFromEnv("SHIPPING_FREE_THRESHOLD_EUR", 120);
  return { ...quote, customerCost: subtotal >= freeThreshold ? 0 : quote.amount, office };
}

export async function createCourierShipment(request: ShipmentRequest): Promise<CreatedShipment> {
  return request.courierProvider === "ECONT" ? createEcontShipment(request) : createSpeedyShipment(request);
}

export async function trackCourierShipment(provider: CourierProvider, shipmentNumber: string): Promise<ShipmentTracking> {
  return provider === "ECONT" ? trackEcontShipment(shipmentNumber) : trackSpeedyShipment(shipmentNumber);
}

export type { CheckoutShippingInput, CourierProvider, PreparedShipping, ShipmentRequest, ShipmentTracking, ShippingOffice } from "@/lib/shipping/types";
