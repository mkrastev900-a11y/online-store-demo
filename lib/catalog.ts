/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { Audience, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

function isDatabaseConfigured() {
  const url = process.env.DATABASE_URL ?? "";
  return Boolean(url) && !url.includes("USER:PASSWORD") && !url.includes("HOST-pooler.REGION") && !url.includes("YOUR_");
}

let catalogSectionTableAvailable: boolean | null = null;

function isMissingCatalogSectionTable(error: unknown) {
  const err = error as { code?: string; meta?: { table?: string; modelName?: string }; message?: string };
  const message = error instanceof Error ? error.message : String(error);
  return err?.code === "P2021" || err?.meta?.table === "public.CatalogSection" || err?.meta?.modelName === "CatalogSection" || message.includes("public.CatalogSection") || message.includes("CatalogSection") && message.includes("does not exist");
}

function markCatalogSectionUnavailable(error: unknown) {
  if (isMissingCatalogSectionTable(error)) {
    catalogSectionTableAvailable = false;
    return true;
  }
  return false;
}

export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  sectionSlug: string | null;
  sectionName: string | null;
  categorySlug: string;
  categoryName: string;
  audience: "WOMEN" | "MEN" | "KIDS";
  isNew: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  stock: number;
  brand?: string | null;
  color?: string | null;
  material?: string | null;
  productType?: "CLOTHING" | "SHOES" | "ACCESSORY";
  productKind?: string | null;
  garmentType?: string | null;
  variants: Array<{ id: number; size: string; stock: number; isActive?: boolean }>;
  images: Array<{ url: string; alt: string | null; sortOrder: number }>;
  hasCustomSizing?: boolean;
  customSizeGuide?: any | null;
  sizeGuide?: null | { id:number; name:string; garmentType:string; description:string; instructions:string; measurements:Array<{id:number;label:string;marker:string;unit:string}>; sizes:Array<{id:number;label:string;values:Array<{measurementId:number;value:number|null}>}> };
};

export type CatalogSection = {
  id: number;
  name: string;
  slug: string;
  eyebrow: string;
  description: string;
  baseAudience: "WOMEN" | "MEN" | "KIDS";
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
};

const DEFAULT_CATALOG_SECTIONS: CatalogSection[] = [
  { id: 1, name: "Дамско", slug: "women", eyebrow: "ДАМСКА МОДА", description: "Елегантни и ежедневни модели.", baseAudience: "WOMEN", isSystem: true, isActive: true, sortOrder: 10 },
  { id: 2, name: "Мъжко", slug: "men", eyebrow: "МЪЖКА МОДА", description: "Изчистени и удобни мъжки модели.", baseAudience: "MEN", isSystem: true, isActive: true, sortOrder: 20 },
  { id: 3, name: "Детско", slug: "kids", eyebrow: "ДЕТСКА МОДА", description: "Практични предложения за деца.", baseAudience: "KIDS", isSystem: true, isActive: true, sortOrder: 30 },
];

const LOCAL_CATALOG_STORE_FILE = path.join(process.cwd(), "data", "catalog-structure.json");

type LocalCatalogStore = {
  sections?: Array<Partial<CatalogSection> & { id: number; name: string; slug: string }>;
  categorySections?: Record<string, number | null>;
  productSections?: Record<string, number | null>;
};

function readLocalCatalogSections(): CatalogSection[] {
  try {
    if (!existsSync(LOCAL_CATALOG_STORE_FILE)) return DEFAULT_CATALOG_SECTIONS;
    const parsed = JSON.parse(readFileSync(LOCAL_CATALOG_STORE_FILE, "utf8")) as LocalCatalogStore;
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const normalized = sections
      .filter((section) => section && typeof section.name === "string" && typeof section.slug === "string")
      .map((section, index) => {
        const name = String(section.name);
        const slug = String(section.slug).replace(/^\/+/, "");
        return {
          id: Number(section.id) || 1000 + index,
          name,
          slug,
          eyebrow: String(section.eyebrow || name.toUpperCase()),
          description: String(section.description || ""),
          baseAudience: (section.baseAudience === "MEN" || section.baseAudience === "KIDS" || section.baseAudience === "WOMEN" ? section.baseAudience : "WOMEN") as "WOMEN" | "MEN" | "KIDS",
          isSystem: Boolean(section.isSystem),
          isActive: section.isActive !== false,
          sortOrder: Number(section.sortOrder) || 100 + index,
        };
      });

    const bySlug = new Map<string, CatalogSection>();
    for (const section of DEFAULT_CATALOG_SECTIONS) bySlug.set(section.slug, section);
    for (const section of normalized) bySlug.set(section.slug, section);
    return Array.from(bySlug.values()).filter((section) => section.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "bg"));
  } catch (error) {
    console.warn("Local catalog sections are not readable. Using default sections.", error);
    return DEFAULT_CATALOG_SECTIONS;
  }
}

function getLocalCatalogSectionBySlug(slug: string): CatalogSection | null {
  const cleanSlug = decodeURIComponent(slug).replace(/^\/+/, "");
  return readLocalCatalogSections().find((section) => section.slug === cleanSlug) ?? null;
}

function readLocalCategorySectionMap(): Record<string, number | null> {
  try {
    if (!existsSync(LOCAL_CATALOG_STORE_FILE)) return {};
    const parsed = JSON.parse(readFileSync(LOCAL_CATALOG_STORE_FILE, "utf8")) as { categorySections?: Record<string, number | null> };
    return parsed.categorySections && typeof parsed.categorySections === "object" ? parsed.categorySections : {};
  } catch {
    return {};
  }
}

function getLocalCategoryIdsForSection(sectionId: number): number[] {
  return Object.entries(readLocalCategorySectionMap())
    .filter(([, mappedSectionId]) => mappedSectionId === sectionId)
    .map(([categoryId]) => Number(categoryId))
    .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0);
}


function readLocalProductSectionMap(): Record<string, number | null> {
  try {
    if (!existsSync(LOCAL_CATALOG_STORE_FILE)) return {};
    const parsed = JSON.parse(readFileSync(LOCAL_CATALOG_STORE_FILE, "utf8")) as LocalCatalogStore;
    return parsed.productSections && typeof parsed.productSections === "object" ? parsed.productSections : {};
  } catch {
    return {};
  }
}

function getLocalProductIdsForSection(sectionId: number): number[] {
  return Object.entries(readLocalProductSectionMap())
    .filter(([, mappedSectionId]) => mappedSectionId === sectionId)
    .map(([productId]) => Number(productId))
    .filter((productId) => Number.isInteger(productId) && productId > 0);
}

function getExplicitProductSectionId(productId: number): number | null {
  const value = readLocalProductSectionMap()[String(productId)];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function productBelongsOnlyToSection(productId: number, sectionId: number): boolean {
  const explicitSectionId = getExplicitProductSectionId(productId);
  return explicitSectionId === null || explicitSectionId === sectionId;
}

function productHasExplicitDifferentSection(productId: number, sectionId: number): boolean {
  const explicitSectionId = getExplicitProductSectionId(productId);
  return explicitSectionId !== null && explicitSectionId !== sectionId;
}

function productHasAnyExplicitSection(productId: number): boolean {
  return getExplicitProductSectionId(productId) !== null;
}

function getCatalogSectionDelegate() {
  if (catalogSectionTableAvailable === false) return null;
  const delegate = (prisma as any).catalogSection;
  return delegate && typeof delegate.findMany === "function" ? delegate : null;
}

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  compareAtPrice: true,
  imageUrl: true,
  audience: true,
  isNew: true,
  isFeatured: true,
  sortOrder: true,
  createdAt: true,
  stock: true,
  brand: true,
  color: true,
  material: true,
  productType: true,
  productKind: true,
  hasCustomSizing: true,
  customSizeGuide: true,
  category: { select: { id: true, name: true, slug: true, sectionId: true } },
  section: { select: { id: true, name: true, slug: true, baseAudience: true } },
  variants: { orderBy: { size: "asc" as const } },
  images: { orderBy: { sortOrder: "asc" as const } },
  sizeGuide: {
    include: {
      measurements: { orderBy: { sortOrder: "asc" as const } },
      sizes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
        include: { values: true },
      },
    },
  },
};


function mapProduct(product: {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  imageUrl: string;
  audience: Audience;
  isNew: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: Date;
  stock: number;
  brand: string | null;
  color: string | null;
  material: string | null;
  productType: "CLOTHING" | "SHOES" | "ACCESSORY";
  productKind?: string | null;
  category: { slug: string; name: string; sectionId?: number | null };
  section?: { id: number; slug: string; name: string; baseAudience: Audience } | null;
  variants?: Array<{ id: number; size: string; stock: number; isActive?: boolean }>;
  images?: Array<{ url: string; alt: string | null; sortOrder: number }>;
  sizeGuide?: any;
  hasCustomSizing?: boolean;
  customSizeGuide?: any;
}): Product {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    imageUrl: product.imageUrl,
    sectionSlug: product.section?.slug ?? DEFAULT_CATALOG_SECTIONS.find((section) => section.baseAudience === product.audience)?.slug ?? null,
    sectionName: product.section?.name ?? DEFAULT_CATALOG_SECTIONS.find((section) => section.baseAudience === product.audience)?.name ?? null,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    audience: product.audience,
    isNew: product.isNew,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    stock: product.stock,
    brand: product.brand,
    color: product.color,
    material: product.material,
    productType: product.productType,
    productKind: product.productKind ?? null,
    garmentType: product.sizeGuide?.garmentType ?? null,
    variants: product.variants ?? [],
    images: product.images ?? [],
    hasCustomSizing: Boolean(product.hasCustomSizing),
    customSizeGuide: product.customSizeGuide ?? null,
    sizeGuide: product.sizeGuide ? {
      ...product.sizeGuide,
      sizes: product.sizeGuide.sizes.map((row: any) => ({
        ...row,
        values: row.values.map((v: any) => ({
          ...v,
          // Размерните стойности могат да съдържат диапазони и означения
          // като 55-62, 55/62, S/M и др. Затова storefront-ът трябва
          // да използва текстовата стойност, а не да я преобразува в Number.
          value: v.valueText ?? (v.value == null ? null : String(v.value)),
        })),
      })),
    } : null,
  };
}


export type PageBuilderProductQuery = {
  source?: "all" | "featured" | "new" | "sale";
  audience?: "ALL" | "MEN" | "WOMEN" | "KIDS";
  categoryId?: number | null;
  brand?: string | null;
  inStock?: boolean;
  sort?: "featured" | "newest" | "price-asc" | "price-desc" | "name";
  limit?: number;
};

export async function getPageBuilderProducts(
  query: PageBuilderProductQuery = {},
): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];

  const limit = Math.min(24, Math.max(1, Number(query.limit) || 8));
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(query.source === "featured" ? { isFeatured: true } : {}),
    ...(query.source === "new" ? { isNew: true } : {}),
    ...(query.source === "sale" ? { compareAtPrice: { not: null } } : {}),
    ...(query.audience && query.audience !== "ALL"
      ? { audience: query.audience as Audience }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brand ? { brand: query.brand } : {}),
    ...(query.inStock ? { stock: { gt: 0 } } : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === "newest"
      ? [{ createdAt: "desc" }]
      : query.sort === "price-asc"
        ? [{ price: "asc" }]
        : query.sort === "price-desc"
          ? [{ price: "desc" }]
          : query.sort === "name"
            ? [{ name: "asc" }]
            : [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }];

  const products = await prisma.product.findMany({
    where,
    select: productSelect,
    orderBy,
    take: limit,
  });

  return products
    .filter((product) =>
      query.source !== "sale" ||
      (product.compareAtPrice !== null &&
        Number(product.compareAtPrice) > Number(product.price)),
    )
    .map(mapProduct);
}

export async function listCatalogSections(): Promise<CatalogSection[]> {
  const delegate = getCatalogSectionDelegate();
  if (!isDatabaseConfigured() || !delegate) return readLocalCatalogSections();

  try {
    const sections = await delegate.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return sections.map((section: any) => ({
      id: section.id,
      name: section.name,
      slug: section.slug,
      eyebrow: section.eyebrow,
      description: section.description,
      baseAudience: section.baseAudience,
      isSystem: section.isSystem,
      isActive: section.isActive,
      sortOrder: section.sortOrder,
    }));
  } catch (error) {
    markCatalogSectionUnavailable(error);
    return readLocalCatalogSections();
  }
}

export async function getCatalogSectionBySlug(slug: string): Promise<CatalogSection | null> {
  const delegate = getCatalogSectionDelegate();
  if (!isDatabaseConfigured() || !delegate) return getLocalCatalogSectionBySlug(slug);

  try {
    const section = await delegate.findFirst({ where: { slug, isActive: true } });
    return section ? { id: section.id, name: section.name, slug: section.slug, eyebrow: section.eyebrow, description: section.description, baseAudience: section.baseAudience, isSystem: section.isSystem, isActive: section.isActive, sortOrder: section.sortOrder } : null;
  } catch (error) {
    markCatalogSectionUnavailable(error);
    return getLocalCatalogSectionBySlug(slug);
  }
}

export async function getProductsBySectionSlug(slug: string): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const delegate = getCatalogSectionDelegate();
  const fallbackSection = getLocalCatalogSectionBySlug(slug);

  if (delegate) {
    try {
      const section = await delegate.findFirst({ where: { slug, isActive: true } });
      catalogSectionTableAvailable = true;
      if (section) {
        const products = await (prisma.product as any).findMany({
          where: {
            isActive: true,
            // Секцията и аудиторията трябва да съвпадат едновременно.
            // Преди тук се филтрираше само по sectionId/category.sectionId,
            // което допускаше мъжки продукти в Дамско при споделена категория.
            audience: section.baseAudience,
            OR: [
              { sectionId: section.id },
              { sectionId: null, category: { sectionId: section.id } },
            ],
          },
          select: productSelect,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        });
        return products.map(mapProduct);
      }
    } catch (error) {
      markCatalogSectionUnavailable(error);
    }
  }

  if (!fallbackSection) return [];

  const localCategoryIds = getLocalCategoryIdsForSection(fallbackSection.id);
  const localProductIds = getLocalProductIdsForSection(fallbackSection.id);

  if (localCategoryIds.length > 0 || localProductIds.length > 0) {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        audience: fallbackSection.baseAudience,
        OR: [
          ...(localCategoryIds.length > 0 ? [{ categoryId: { in: localCategoryIds } }] : []),
          ...(localProductIds.length > 0 ? [{ id: { in: localProductIds } }] : []),
        ],
      },
      select: productSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return products
      .filter((product) => !productHasExplicitDifferentSection(product.id, fallbackSection.id))
      .map((product) => ({
        ...mapProduct(product),
        sectionSlug: fallbackSection.slug,
        sectionName: fallbackSection.name,
      }));
  }

  if (fallbackSection.isSystem) {
    const products = await getProductsByAudience(fallbackSection.baseAudience);
    return products.filter((product) => productBelongsOnlyToSection(product.id, fallbackSection.id));
  }

  return [];
}

export async function getProductsByAudience(
  audience: Product["audience"],
): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const products = await prisma.product.findMany({
    where: { audience: audience as Audience, isActive: true },
    select: productSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return products
    .filter((product) => !productHasAnyExplicitSection(product.id))
    .map(mapProduct);
}

export async function getNewProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const products = await prisma.product.findMany({
    where: { isNew: true, isActive: true },
    select: productSelect,
    orderBy: { createdAt: "desc" },
  });

  return products.map(mapProduct);
}

export async function getSaleProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const products = await prisma.product.findMany({
    where: { isActive: true, compareAtPrice: { not: null } },
    select: productSelect,
    orderBy: { createdAt: "desc" },
  });

  return products
    .filter(
      (product) =>
        product.compareAtPrice !== null &&
        Number(product.compareAtPrice) > Number(product.price),
    )
    .map(mapProduct);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return [];
  const products = await prisma.product.findMany({
    where: { isFeatured: true, isActive: true },
    select: productSelect,
    orderBy: { sortOrder: "asc" },
    take: 8,
  });

  return products.map(mapProduct);
}


export async function getProductBySlug(
  slug: string,
): Promise<Product | null> {
  if (!isDatabaseConfigured()) return null;
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: productSelect,
  });

  return product ? mapProduct(product) : null;
}
