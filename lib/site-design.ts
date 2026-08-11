import { prisma } from "@/lib/prisma";
import { compileDesignCss } from "@/lib/design-engine";
import { DEFAULT_STORE_NAME, DEFAULT_STORE_TAGLINE } from "@/lib/brand";
import { DEFAULT_CONTACT_EMAILS, normalizePublicContactEmail } from "@/lib/contact-config";

export const DEFAULT_SITE_DESIGN = {
  id: 1, brandName: DEFAULT_STORE_NAME, tagline: DEFAULT_STORE_TAGLINE, logoUrl: "", darkLogoUrl: "", faviconUrl: null,
  primaryColor: "#5c0b2d", secondaryColor: "#cda64d", lightBackground: "#fbf7f2", lightSurface: "#fffdf9", lightText: "#21161b",
  darkBackground: "#0d1119", darkSurface: "#151c27", darkText: "#f6f0f2", borderRadius: 18,
  fontFamily: "Arial, Helvetica, sans-serif", headingFontFamily: "Georgia, serif", designTokensJson: "{}",
  heroVariant: "classic", categoriesVariant: "overlay", productsVariant: "grid",
  showHero: true, showBenefits: true, showCategories: true, showProducts: true,
  homepageSectionOrder: "hero,benefits,categories,products",
  customSectionsJson: "[]",
  pageContentJson: "{}",
  navigationItemsJson: JSON.stringify([
    { href: "/", label: "Начало", visible: true }, { href: "/women", label: "Дамско", visible: true },
    { href: "/men", label: "Мъжко", visible: true }, { href: "/kids", label: "Детско", visible: true },
    { href: "/new", label: "Нови", visible: true }, { href: "/sale", label: "Промоции", visible: true },
    { href: "/contact", label: "Контакти", visible: true }, { href: "/about", label: "За нас", visible: true }
  ]),
  heroEyebrow: "НОВА КОЛЕКЦИЯ", heroTitle: "Елегантност, която подчертава теб",
  heroDescription: "Подбрани модели с внимание към детайла и качество, на което можеш да разчиташ.",
  heroButtonText: "Разгледай колекцията", heroButtonHref: "/new",
  heroImageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=2200&q=92",
  benefitsTitle1: "Безплатна доставка", benefitsText1: "Над 120 €",
  benefitsTitle2: "14 дни право на връщане", benefitsText2: "Лесно и бързо",
  benefitsTitle3: "Сигурно плащане", benefitsText3: "100% защита",
  benefitsTitle4: "Качествени материали", benefitsText4: "Гарантирано качество",
  categoriesTitle: "Пазарувай по категории",
  womenTitle: "Дамско", womenDescription: "Открий стил и елегантност", womenImageUrl: "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=1000&q=90",
  menTitle: "Мъжко", menDescription: "Класика и модерна визия за всеки ден", menImageUrl: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1000&q=90",
  kidsTitle: "Детско", kidsDescription: "Комфорт и качество за вашите деца", kidsImageUrl: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=1000&q=90",
  categoryButtonText: "Разгледай", productsTitle: "Нови продукти", productsLinkText: "Виж всички",
  footerEyebrow: "КЛУБ", footerTitle: "Първи научавай за новите предложения",
  footerDescription: "Абонирай се за новини, промоции и специални предложения.",
  footerAbout: "Качествени продукти, сигурно пазаруване и обслужване с внимание.",
  footerShopTitle: "Пазарувай", footerHelpTitle: "Помощ", footerSocialTitle: "Последвай ни",
  footerCopyright: "© 2026 Всички права запазени", instagramUrl: "", facebookUrl: "", tiktokUrl: "",
  seoTitle: `${DEFAULT_STORE_NAME} | ${DEFAULT_STORE_TAGLINE}`,
  seoDescription: "Премиум онлайн селекция от дамска, мъжка и детска мода, обувки и аксесоари.",
  seoKeywords: "мода, дамски дрехи, мъжки дрехи, детски дрехи, онлайн магазин",
  seoCanonicalUrl: "", seoOgImageUrl: "", seoIndex: true, seoFollow: true,
};

export type SiteDesign = Omit<typeof DEFAULT_SITE_DESIGN, "faviconUrl"> & { faviconUrl: string | null };

export type DesignTokenOverrides = Record<string, string | number | boolean>;

export function parseDesignTokenOverrides(value: string | null | undefined): DesignTokenOverrides {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const tokens: DesignTokenOverrides = {};
    for (const [key, token] of Object.entries(parsed)) {
      if (!/^[a-z][a-zA-Z0-9.-]{1,80}$/.test(key)) continue;
      if (typeof token === "string" || typeof token === "number" || typeof token === "boolean") {
        tokens[key] = token;
      }
    }

    return tokens;
  } catch {
    return {};
  }
}

export function serializeDesignTokenOverrides(tokens: DesignTokenOverrides) {
  return JSON.stringify(tokens);
}

const PERSISTENT_SOCIAL_TOKEN_KEYS = [
  "social.facebook.enabled",
  "social.instagram.enabled",
  "social.tiktok.enabled",
] as const;

/**
 * Social-network visibility is managed by /admin/social-networks and must not be
 * overwritten by stale Visual Editor/theme snapshots. Keep the values already
 * stored in SiteDesignSettings while allowing every other design token to update.
 */
export function preservePersistentSocialTokens(currentJson: string | null | undefined, incomingJson: string | null | undefined) {
  const current = parseDesignTokenOverrides(currentJson);
  const incoming = parseDesignTokenOverrides(incomingJson);
  for (const key of PERSISTENT_SOCIAL_TOKEN_KEYS) {
    if (typeof current[key] === "boolean") incoming[key] = current[key];
    else delete incoming[key];
  }
  return serializeDesignTokenOverrides(incoming);
}

export function getPrimaryContactPhone(design: Pick<SiteDesign, "designTokensJson">) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  const value = String(tokens["contact.primaryPhone"] ?? "").trim();
  return value || process.env.NEXT_PUBLIC_STORE_PHONE?.trim() || "";
}

export function withPrimaryContactPhone(design: Pick<SiteDesign, "designTokensJson">, phone: string) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  tokens["contact.primaryPhone"] = phone.trim();
  return serializeDesignTokenOverrides(tokens);
}


export const DEFAULT_CONTACT_CONTENT = {
  email: DEFAULT_CONTACT_EMAILS.office,
  secondaryPhone: "",
  workingHours: "Понеделник – Петък: 09:00 – 18:00",
  address: "Онлайн магазин — доставки в цяла България",
  formTitle: "Изпрати запитване",
  formDescription: "Полетата, отбелязани със звездичка, са задължителни.",
  infoTitle: "Контактна информация",
  infoDescription: "Можеш да се свържеш с нас и директно.",
  phoneTitle: "Телефон",
  phoneDescription: "За поръчки и общи въпроси",
  emailTitle: "Имейл",
  emailDescription: "Отговаряме обичайно в рамките на един работен ден.",
  hoursTitle: "Работно време",
  hoursDescription: "Съобщение през формата можеш да изпратиш по всяко време.",
  addressTitle: "Адрес и обслужване",
  addressDescription: "Доставка с Еконт и Спиди до офис, автомат или адрес.",
  quick1Eyebrow: "ПОРЪЧКИ",
  quick1Title: "Посочи номера на поръчката",
  quick1Text: "Така ще намерим покупката ти и ще отговорим по-бързо.",
  quick2Eyebrow: "ДОСТАВКА",
  quick2Title: "Еконт или Спиди",
  quick2Text: "До офис, автомат или избран от теб адрес.",
  quick3Eyebrow: "ВРЪЩАНЕ",
  quick3Title: "До 14 дни",
  quick3Text: "Пиши ни, за да ти дадем точните стъпки за връщане.",
} as const;

export type ContactContentKey = keyof typeof DEFAULT_CONTACT_CONTENT;

export function getContactContentValue(design: Pick<SiteDesign, "designTokensJson">, key: ContactContentKey) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  const value = String(tokens[`contact.${key}`] ?? "").trim();
  if (key === "email") return normalizePublicContactEmail(value, "office");
  return value || DEFAULT_CONTACT_CONTENT[key];
}

export function withContactContentValue(design: Pick<SiteDesign, "designTokensJson">, key: ContactContentKey, value: string) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  tokens[`contact.${key}`] = value;
  return serializeDesignTokenOverrides(tokens);
}

export type CustomHomeSection = {
  id: string;
  type: "promo" | "text" | "imageText" | "faq" | "testimonials" | "brands";
  enabled: boolean;
  title: string;
  text: string;
  buttonText: string;
  buttonHref: string;
  imageUrl: string;
  alignment: "left" | "center" | "right";
  items?: Array<{ id: string; title: string; text: string; imageUrl?: string; href?: string }>;
};

export function parseCustomHomeSections(value: string | null | undefined): CustomHomeSection[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CustomHomeSection => Boolean(item && typeof item === "object" && typeof item.id === "string" && ["promo", "text", "imageText", "faq", "testimonials", "brands"].includes(item.type)));
  } catch {
    return [];
  }
}


const ORIGINAL_PALETTE_VERSION = 3;

function parseRawDesignTokens(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function getSiteDesign(): Promise<SiteDesign> {
  try {
    const row = await prisma.siteDesignSettings.findUnique({ where: { id: 1 } });
    if (!row) return { ...DEFAULT_SITE_DESIGN };

    const storedTokens = parseRawDesignTokens(row.designTokensJson);
    if (storedTokens["system.originalPaletteVersion"] !== ORIGINAL_PALETTE_VERSION) {
      // Read paths must remain read-only. The marker is compatibility metadata,
      // so apply it in memory instead of mutating Neon during a storefront GET.
      return {
        ...DEFAULT_SITE_DESIGN,
        ...row,
        designTokensJson: JSON.stringify({
          ...storedTokens,
          "system.originalPaletteVersion": ORIGINAL_PALETTE_VERSION,
        }),
      };
    }

    return { ...DEFAULT_SITE_DESIGN, ...row };
  } catch {
    return { ...DEFAULT_SITE_DESIGN };
  }
}

export function designCss(d: SiteDesign) {
  return compileDesignCss(d);
}
