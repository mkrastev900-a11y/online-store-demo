import { prisma } from "@/lib/prisma";
import { parseDesignTokenOverrides, serializeDesignTokenOverrides } from "@/lib/site-design";

import {
  SOCIAL_NETWORK_META,
  type PublicSocialNetworkLink,
  type SocialNetworkKey,
  type SocialNetworkLink,
  type SocialNetworksStore,
} from "@/lib/social-network-types";

export { SOCIAL_NETWORK_META };
export type { PublicSocialNetworkLink, SocialNetworkKey, SocialNetworkLink, SocialNetworksStore };

export const DEFAULT_SOCIAL_NETWORKS: SocialNetworksStore = {
  facebook: { enabled: false, url: "" },
  instagram: { enabled: false, url: "" },
  tiktok: { enabled: false, url: "" },
  updatedAt: null,
};

function cleanUrl(value: unknown) {
  const url = String(value ?? "").trim().slice(0, 500);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function normalizeLink(value: unknown): SocialNetworkLink {
  const link = value && typeof value === "object" ? value as Partial<SocialNetworkLink> : {};
  return {
    enabled: Boolean(link.enabled),
    url: cleanUrl(link.url),
  };
}

export function normalizeSocialNetworks(input: unknown): SocialNetworksStore {
  const value = input && typeof input === "object" ? input as Partial<SocialNetworksStore> : {};
  return {
    facebook: normalizeLink(value.facebook),
    instagram: normalizeLink(value.instagram),
    tiktok: normalizeLink(value.tiktok),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function enabledFromTokens(tokens: Record<string, string | number | boolean>, key: SocialNetworkKey, url: string) {
  const stored = tokens[`social.${key}.enabled`];
  // Existing links saved before the enabled flags were moved to the database
  // remain visible instead of silently disappearing after this update.
  return typeof stored === "boolean" ? stored : url.trim().length > 0;
}

export async function readSocialNetworks(): Promise<SocialNetworksStore> {
  try {
    const row = await prisma.siteDesignSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_SOCIAL_NETWORKS;

    const tokens = parseDesignTokenOverrides(row.designTokensJson);
    const facebookUrl = cleanUrl(row.facebookUrl);
    const instagramUrl = cleanUrl(row.instagramUrl);
    const tiktokUrl = cleanUrl(row.tiktokUrl);

    return {
      facebook: { enabled: enabledFromTokens(tokens, "facebook", facebookUrl), url: facebookUrl },
      instagram: { enabled: enabledFromTokens(tokens, "instagram", instagramUrl), url: instagramUrl },
      tiktok: { enabled: enabledFromTokens(tokens, "tiktok", tiktokUrl), url: tiktokUrl },
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    console.warn("Social networks could not be read from the database.", error);
    return DEFAULT_SOCIAL_NETWORKS;
  }
}

export async function saveSocialNetworks(input: unknown): Promise<SocialNetworksStore> {
  const normalized = normalizeSocialNetworks(input);

  const current = await prisma.siteDesignSettings.findUnique({ where: { id: 1 } });
  const tokens = parseDesignTokenOverrides(current?.designTokensJson ?? "{}");
  tokens["social.facebook.enabled"] = normalized.facebook.enabled;
  tokens["social.instagram.enabled"] = normalized.instagram.enabled;
  tokens["social.tiktok.enabled"] = normalized.tiktok.enabled;

  const row = await prisma.siteDesignSettings.upsert({
    where: { id: 1 },
    update: {
      facebookUrl: normalized.facebook.url,
      instagramUrl: normalized.instagram.url,
      tiktokUrl: normalized.tiktok.url,
      designTokensJson: serializeDesignTokenOverrides(tokens),
    },
    create: {
      id: 1,
      facebookUrl: normalized.facebook.url,
      instagramUrl: normalized.instagram.url,
      tiktokUrl: normalized.tiktok.url,
      designTokensJson: serializeDesignTokenOverrides(tokens),
    },
  });

  return {
    facebook: { enabled: normalized.facebook.enabled, url: cleanUrl(row.facebookUrl) },
    instagram: { enabled: normalized.instagram.enabled, url: cleanUrl(row.instagramUrl) },
    tiktok: { enabled: normalized.tiktok.enabled, url: cleanUrl(row.tiktokUrl) },
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function getPublicSocialNetworks(input: SocialNetworksStore): PublicSocialNetworkLink[] {
  return (["facebook", "instagram", "tiktok"] as SocialNetworkKey[])
    .map((key) => ({ key, settings: input[key], meta: SOCIAL_NETWORK_META[key] }))
    .filter((item) => item.settings.enabled && item.settings.url.trim().length > 0)
    .map((item) => ({
      key: item.key,
      label: item.meta.label,
      icon: item.meta.icon,
      url: item.settings.url,
    }));
}
