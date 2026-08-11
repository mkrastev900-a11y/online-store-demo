import { prisma } from "@/lib/prisma";

export type MarketingProviderKey = "google" | "meta" | "tiktok";
export type MarketingEventKey = "pageView" | "viewContent" | "addToCart" | "initiateCheckout" | "purchase";

export type MarketingProviderSettings = {
  enabled: boolean;
  id: string;
  testMode: boolean;
};

export type MarketingEventSettings = Record<MarketingEventKey, boolean>;

export type MarketingIntegrationsStore = {
  google: MarketingProviderSettings;
  meta: MarketingProviderSettings;
  tiktok: MarketingProviderSettings;
  events: MarketingEventSettings;
  updatedAt: string | null;
};

export type PublicMarketingIntegrations = MarketingIntegrationsStore;

export const DEFAULT_MARKETING_INTEGRATIONS: MarketingIntegrationsStore = {
  google: { enabled: false, id: "", testMode: false },
  meta: { enabled: false, id: "", testMode: false },
  tiktok: { enabled: false, id: "", testMode: false },
  events: {
    pageView: true,
    viewContent: true,
    addToCart: true,
    initiateCheckout: true,
    purchase: true,
  },
  updatedAt: null,
};

function cleanId(value: unknown) {
  const id = String(value ?? "").trim().slice(0, 120);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function normalizeProvider(value: unknown): MarketingProviderSettings {
  const provider = value && typeof value === "object" ? value as Partial<MarketingProviderSettings> : {};
  return {
    enabled: Boolean(provider.enabled),
    id: cleanId(provider.id),
    testMode: Boolean(provider.testMode),
  };
}

function normalizeEvents(value: unknown): MarketingEventSettings {
  const events = value && typeof value === "object" ? value as Partial<MarketingEventSettings> : {};
  return {
    pageView: events.pageView !== false,
    viewContent: events.viewContent !== false,
    addToCart: events.addToCart !== false,
    initiateCheckout: events.initiateCheckout !== false,
    purchase: events.purchase !== false,
  };
}

export function normalizeMarketingIntegrations(input: unknown): MarketingIntegrationsStore {
  const value = input && typeof input === "object" ? input as Partial<MarketingIntegrationsStore> : {};
  return {
    google: normalizeProvider(value.google),
    meta: normalizeProvider(value.meta),
    tiktok: normalizeProvider(value.tiktok),
    events: normalizeEvents(value.events),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

export async function readMarketingIntegrations(): Promise<MarketingIntegrationsStore> {
  try {
    const row = await prisma.marketingIntegrationSettings.findUnique({ where: { id: 1 }, select: { data: true, updatedAt: true } });
    if (!row) return DEFAULT_MARKETING_INTEGRATIONS;
    const normalized = normalizeMarketingIntegrations(row.data);
    return { ...normalized, updatedAt: row.updatedAt.toISOString() };
  } catch (error) {
    console.warn("Marketing integrations store is not readable. Using defaults.", error);
    return DEFAULT_MARKETING_INTEGRATIONS;
  }
}

export async function saveMarketingIntegrations(input: unknown): Promise<MarketingIntegrationsStore> {
  const normalized = normalizeMarketingIntegrations(input);
  const row = await prisma.marketingIntegrationSettings.upsert({
    where: { id: 1 },
    create: { id: 1, data: normalized },
    update: { data: normalized },
    select: { data: true, updatedAt: true },
  });
  return { ...normalizeMarketingIntegrations(row.data), updatedAt: row.updatedAt.toISOString() };
}

export async function getPublicMarketingIntegrations(): Promise<PublicMarketingIntegrations> {
  return readMarketingIntegrations();
}
