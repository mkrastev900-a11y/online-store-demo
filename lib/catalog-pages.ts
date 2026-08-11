import type { SiteDesign } from "@/lib/site-design";

export type CatalogPageTemplate = "men" | "women" | "kids";

export type CatalogPageConfig = {
  id: string;
  label: string;
  slug: string;
  path: string;
  template: CatalogPageTemplate;
  active: boolean;
  sortOrder: number;
  eyebrow: string;
  title: string;
  description: string;
};

export type CategoryPageMap = Record<string, string>;

const RESERVED_PATHS = new Set([
  "/", "/women", "/men", "/kids", "/new", "/sale", "/about", "/contact", "/cart", "/checkout", "/login", "/register", "/account", "/favorites", "/history", "/search", "/admin", "/visual-editor", "/products",
]);

export function slugifyCatalogPage(value: string) {
  const basic = value
    .trim()
    .toLocaleLowerCase("bg-BG")
    .replace(/[ъ]/g, "a")
    .replace(/[а-я]/g, (letter) => ({
      а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sht",ь:"y",ю:"yu",я:"ya",
    } as Record<string,string>)[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return basic || `page-${Date.now()}`;
}

export function normalizeCatalogPath(pathOrSlug: string) {
  const raw = pathOrSlug.trim();
  const withoutHost = raw.replace(/^https?:\/\/[^/]+/i, "");
  const first = withoutHost.split(/[?#]/)[0] || raw;
  const slug = slugifyCatalogPage(first.replace(/^\/+/, ""));
  return `/${slug}`;
}

function readTokens(design: Pick<SiteDesign, "designTokensJson">): Record<string, unknown> {
  try {
    const parsed = JSON.parse(design.designTokensJson || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function createDefaultCatalogPage(partial: Partial<CatalogPageConfig>): CatalogPageConfig {
  const label = partial.label?.trim() || "Нова страница";
  const slug = slugifyCatalogPage(partial.slug || label);
  const path = normalizeCatalogPath(partial.path || slug);
  const template = partial.template === "women" || partial.template === "kids" ? partial.template : "men";
  return {
    id: partial.id || `catalog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    slug: path.replace(/^\//, ""),
    path,
    template,
    active: partial.active !== false,
    sortOrder: Number.isFinite(Number(partial.sortOrder)) ? Number(partial.sortOrder) : 100,
    eyebrow: partial.eyebrow?.trim() || "КАТАЛОГ",
    title: partial.title?.trim() || label,
    description: partial.description?.trim() || "Добави категории към тази страница от Админ → Категории.",
  };
}

export function parseCatalogPages(design: Pick<SiteDesign, "designTokensJson">): CatalogPageConfig[] {
  const tokens = readTokens(design);
  const raw = tokens["catalog.pages"];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  const used = new Set<string>();
  return parsed
    .map((item) => createDefaultCatalogPage((item && typeof item === "object" ? item : {}) as Partial<CatalogPageConfig>))
    .filter((page) => {
      if (!page.path || RESERVED_PATHS.has(page.path) || used.has(page.path)) return false;
      used.add(page.path);
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "bg"));
}

export function withCatalogPages(design: Pick<SiteDesign, "designTokensJson">, pages: CatalogPageConfig[]) {
  const tokens = readTokens(design);
  tokens["catalog.pages"] = JSON.stringify(pages.map(createDefaultCatalogPage));
  return JSON.stringify(tokens);
}

export function parseCategoryPageMap(design: Pick<SiteDesign, "designTokensJson">): CategoryPageMap {
  const tokens = readTokens(design);
  const raw = tokens["catalog.categoryPageMap"];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([slug, path]) => typeof slug === "string" && typeof path === "string")
      .map(([slug, path]) => [slug, normalizeCatalogPath(path as string)]),
  );
}

export function withCategoryPageMap(design: Pick<SiteDesign, "designTokensJson">, map: CategoryPageMap) {
  const tokens = readTokens(design);
  tokens["catalog.categoryPageMap"] = JSON.stringify(map);
  return JSON.stringify(tokens);
}

export function catalogPageLinkOptions(design: Pick<SiteDesign, "designTokensJson">) {
  return parseCatalogPages(design)
    .filter((page) => page.active)
    .map((page) => ({ label: page.label, value: page.path, group: "Каталог страници" }));
}

export function findCatalogPageByPath(design: Pick<SiteDesign, "designTokensJson">, path: string) {
  const normalized = normalizeCatalogPath(path);
  return parseCatalogPages(design).find((page) => page.active && page.path === normalized) ?? null;
}
