/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { Audience } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type StoredSection = {
  id: number;
  name: string;
  slug: string;
  eyebrow: string;
  description: string;
  baseAudience: Audience;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  _count?: { categories: number; products: number };
};

const DEFAULT_ADMIN_SECTIONS: Array<StoredSection & { _count: { categories: number; products: number } }> = [
  { id: 1, name: "Дамско", slug: "women", eyebrow: "ДАМСКА МОДА", description: "Елегантни и ежедневни модели.", baseAudience: "WOMEN" as Audience, isSystem: true, isActive: true, sortOrder: 10, _count: { categories: 0, products: 0 } },
  { id: 2, name: "Мъжко", slug: "men", eyebrow: "МЪЖКА МОДА", description: "Изчистени и удобни мъжки модели.", baseAudience: "MEN" as Audience, isSystem: true, isActive: true, sortOrder: 20, _count: { categories: 0, products: 0 } },
  { id: 3, name: "Детско", slug: "kids", eyebrow: "ДЕТСКА МОДА", description: "Практични предложения за деца.", baseAudience: "KIDS" as Audience, isSystem: true, isActive: true, sortOrder: 30, _count: { categories: 0, products: 0 } },
];
type CatalogStructureStore = {
  nextSectionId: number;
  sections: StoredSection[];
  categorySections: Record<string, number | null>;
  productSections: Record<string, number | null>;
};

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "catalog-structure.json");

function isPrismaStructureError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("CatalogSection") || message.includes("Category.sectionId") || message.includes("Product.sectionId") || message.includes("does not exist") || message.includes("Unknown field");
}

let catalogStructurePrismaAvailable: boolean | null = null;

function markStructurePrismaUnavailable(error: unknown) {
  if (isPrismaStructureError(error)) {
    catalogStructurePrismaAvailable = false;
    return true;
  }
  return false;
}

function ensureStoreDir() {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
}

function emptyStore(): CatalogStructureStore {
  return {
    nextSectionId: 1000,
    sections: DEFAULT_ADMIN_SECTIONS.map(({ _count, ...section }) => ({ ...section })),
    categorySections: {},
    productSections: {},
  };
}

function readStore(): CatalogStructureStore {
  try {
    if (!existsSync(STORE_FILE)) return emptyStore();
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<CatalogStructureStore>;
    const store: CatalogStructureStore = {
      nextSectionId: Number(parsed.nextSectionId) > 0 ? Number(parsed.nextSectionId) : 1000,
      sections: Array.isArray(parsed.sections) ? parsed.sections as StoredSection[] : [],
      categorySections: parsed.categorySections && typeof parsed.categorySections === "object" ? parsed.categorySections as Record<string, number | null> : {},
      productSections: parsed.productSections && typeof parsed.productSections === "object" ? parsed.productSections as Record<string, number | null> : {},
    };
    const existingIds = new Set(store.sections.map((section) => section.id));
    for (const defaultSection of DEFAULT_ADMIN_SECTIONS) {
      if (!existingIds.has(defaultSection.id)) {
        const { _count, ...section } = defaultSection;
        store.sections.push({ ...section });
      }
    }
    store.sections.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "bg"));
    return store;
  } catch (error) {
    console.warn("Local catalog structure store is not readable. Using defaults.", error);
    return emptyStore();
  }
}

function writeStore(store: CatalogStructureStore) {
  try {
    ensureStoreDir();
    writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (code === "EROFS" || code === "EACCES") {
      console.warn("Local catalog compatibility store is read-only; database state remains authoritative.");
      return;
    }
    throw error;
  }
}

function getCatalogSectionDelegate() {
  if (catalogStructurePrismaAvailable === false) return null;
  const delegate = (prisma as any).catalogSection;
  return delegate && typeof delegate.findMany === "function" ? delegate : null;
}

function decorateStoredSections(store: CatalogStructureStore) {
  const categoryCounts = new Map<number, number>();
  for (const sectionId of Object.values(store.categorySections)) {
    if (typeof sectionId === "number") categoryCounts.set(sectionId, (categoryCounts.get(sectionId) ?? 0) + 1);
  }
  return store.sections
    .map((section) => ({ ...section, _count: { categories: categoryCounts.get(section.id) ?? 0, products: section._count?.products ?? 0 } }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "bg"));
}

function getStoredSection(id: number) {
  return decorateStoredSections(readStore()).find((section) => section.id === id) ?? null;
}

function withSectionId<T extends Record<string, unknown>>(data: T, sectionId: number | null) {
  return sectionId ? { ...data, sectionId } : data;
}

export type AdminCatalogSectionInput = {
  name: string;
  slug: string;
  eyebrow?: string;
  description?: string;
  baseAudience?: Audience;
  isActive?: boolean;
  sortOrder?: number;
};

export type AdminCategoryInput = {
  name: string;
  slug: string;
  sectionId: number | null;
};


export function getStoredProductSectionId(productId: number): number | null {
  const store = readStore();
  const value = store.productSections[String(productId)];
  return typeof value === "number" ? value : null;
}

export function setStoredProductSectionId(productId: number, sectionId: number | null | undefined) {
  const store = readStore();
  if (sectionId === undefined || sectionId === null) {
    delete store.productSections[String(productId)];
  } else {
    store.productSections[String(productId)] = sectionId;
  }
  writeStore(store);
}

export function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "section";
}

export async function listAdminCatalogSections() {
  const delegate = getCatalogSectionDelegate();
  if (delegate) {
    try {
      catalogStructurePrismaAvailable = true;
      return await delegate.findMany({
        include: { _count: { select: { categories: true, products: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    } catch (error) {
      if (!isPrismaStructureError(error)) throw error;
      markStructurePrismaUnavailable(error);
    }
  }
  return decorateStoredSections(readStore());
}

export async function createAdminCatalogSection(input: AdminCatalogSectionInput) {
  const payload = {
    name: input.name,
    slug: slugify(input.slug || input.name),
    eyebrow: input.eyebrow || input.name.toUpperCase(),
    description: input.description || "",
    baseAudience: input.baseAudience ?? ("WOMEN" as Audience),
    isActive: input.isActive !== false,
    sortOrder: input.sortOrder ?? 100,
  };

  const delegate = getCatalogSectionDelegate();
  if (delegate) {
    try {
      catalogStructurePrismaAvailable = true;
      return await delegate.create({ data: payload });
    } catch (error) {
      if (!isPrismaStructureError(error)) throw error;
      markStructurePrismaUnavailable(error);
    }
  }

  const store = readStore();
  const section = { id: store.nextSectionId, ...payload, isSystem: false };
  store.nextSectionId += 1;
  store.sections.push(section);
  writeStore(store);
  return { ...section, _count: { categories: 0, products: 0 } };
}

export async function updateAdminCatalogSection(id: number, input: Partial<AdminCatalogSectionInput>) {
  const delegate = getCatalogSectionDelegate();
  if (delegate) {
    try {
      catalogStructurePrismaAvailable = true;
      return await delegate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
          ...(input.eyebrow !== undefined ? { eyebrow: input.eyebrow } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.baseAudience !== undefined ? { baseAudience: input.baseAudience } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
    } catch (error) {
      if (!isPrismaStructureError(error)) throw error;
      markStructurePrismaUnavailable(error);
    }
  }

  const store = readStore();
  const index = store.sections.findIndex((section) => section.id === id);
  if (index === -1) throw new Error("Секцията не е намерена.");
  store.sections[index] = {
    ...store.sections[index],
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
    ...(input.eyebrow !== undefined ? { eyebrow: input.eyebrow } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
  writeStore(store);
  return getStoredSection(id);
}

export async function deleteAdminCatalogSection(id: number) {
  const delegate = getCatalogSectionDelegate();
  if (delegate) {
    try {
      const section = await delegate.findUnique({ where: { id }, include: { _count: { select: { categories: true, products: true } } } });
      if (!section) throw new Error("Секцията не е намерена.");
      if (section.isSystem) throw new Error("Системните секции не могат да се трият, само да се скриват от менюто.");
      if (section._count.categories > 0 || section._count.products > 0) {
        await delegate.update({ where: { id }, data: { isActive: false } });
        return { deleted: false, archived: true };
      }
      await delegate.delete({ where: { id } });
      return { deleted: true, archived: false };
    } catch (error) {
      if (!isPrismaStructureError(error)) throw error;
      markStructurePrismaUnavailable(error);
    }
  }

  const store = readStore();
  const section = store.sections.find((item) => item.id === id);
  if (!section) throw new Error("Секцията не е намерена.");
  if (section.isSystem) throw new Error("Системните секции не могат да се трият, само да се скриват от менюто.");
  const hasCategories = Object.values(store.categorySections).some((sectionId) => sectionId === id);
  if (hasCategories) {
    store.sections = store.sections.map((item) => item.id === id ? { ...item, isActive: false } : item);
    writeStore(store);
    return { deleted: false, archived: true };
  }
  store.sections = store.sections.filter((item) => item.id !== id);
  writeStore(store);
  return { deleted: true, archived: false };
}

const categoryCompatSelect = {
  id: true,
  name: true,
  slug: true,
  _count: { select: { products: true } },
};

type CompatCategory = { id: number; name: string; slug: string; _count?: { products: number } };

function normalizeCategoryForTransitionalMode(category: CompatCategory) {
  const store = readStore();
  const sectionId = store.categorySections[String(category.id)] ?? null;
  const section = typeof sectionId === "number" ? decorateStoredSections(store).find((item) => item.id === sectionId) ?? null : null;
  return { ...category, sectionId, section: section ? { id: section.id, name: section.name, slug: section.slug } : null };
}

export async function listAdminCategoriesWithSections() {
  try {
    if (getCatalogSectionDelegate()) {
      return await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          sectionId: true,
          section: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }
  } catch (error) {
    if (!isPrismaStructureError(error)) throw error;
    markStructurePrismaUnavailable(error);
  }

  const categories = await prisma.category.findMany({ select: categoryCompatSelect, orderBy: [{ name: "asc" }] });
  return categories.map(normalizeCategoryForTransitionalMode);
}

export async function createAdminCategory(input: AdminCategoryInput) {
  try {
    const category = await prisma.category.create({
      data: withSectionId({ name: input.name, slug: slugify(input.slug || input.name) }, input.sectionId),
      select: {
        id: true,
        name: true,
        slug: true,
        sectionId: true,
        section: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true } },
      },
    });
    return category;
  } catch (error) {
    if (!isPrismaStructureError(error)) throw error;
    const category = await prisma.category.create({ data: { name: input.name, slug: slugify(input.slug || input.name) }, select: categoryCompatSelect });
    const store = readStore();
    store.categorySections[String(category.id)] = input.sectionId ?? null;
    writeStore(store);
    return normalizeCategoryForTransitionalMode(category);
  }
}

export async function updateAdminCategory(id: number, input: Partial<AdminCategoryInput>) {
  try {
    const category = await prisma.$transaction(async (tx) => {
      const current = await tx.category.findUnique({ where: { id }, select: { sectionId: true } });
      if (!current) throw new Error("Категорията не е намерена.");

      const nextSectionId = input.sectionId !== undefined ? input.sectionId : current.sectionId;
      if (nextSectionId !== null) {
        const sectionExists = await tx.catalogSection.findUnique({ where: { id: nextSectionId }, select: { id: true } });
        if (!sectionExists) throw new Error("Избраната секция не съществува.");
      }

      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
          ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          sectionId: true,
          section: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true } },
        },
      });

      if (input.sectionId !== undefined && current.sectionId !== input.sectionId) {
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { sectionId: input.sectionId },
        });
      }
      return updated;
    });
    return category;
  } catch (error) {
    if (!isPrismaStructureError(error)) throw error;
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
      },
      select: categoryCompatSelect,
    });
    if (input.sectionId !== undefined) {
      const store = readStore();
      store.categorySections[String(id)] = input.sectionId ?? null;
      writeStore(store);
    }
    return normalizeCategoryForTransitionalMode(category);
  }
}

export async function deleteAdminCategory(id: number) {
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true, _count: { select: { products: true } } } });
  if (!category) throw new Error("Категорията не е намерена.");
  if (category._count.products > 0) throw new Error("Категорията има продукти. Премести продуктите преди изтриване.");

  // The database is the source of truth. On Vercel /var/task is read-only, so a
  // legacy JSON cleanup must never turn a successful database delete into an
  // API error (which made the client restore an already deleted category).
  await prisma.category.delete({ where: { id } });

  try {
    const store = readStore();
    if (Object.prototype.hasOwnProperty.call(store.categorySections, String(id))) {
      delete store.categorySections[String(id)];
      writeStore(store);
    }
  } catch (error) {
    console.warn("Legacy category-section cleanup was skipped after database deletion.", error);
  }
}
