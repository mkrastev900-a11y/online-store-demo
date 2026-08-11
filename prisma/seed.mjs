/* eslint-disable @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { PrismaClient } from "@prisma/client";
import { ensureTestAdmin } from "../scripts/bootstrap-test-admin.mjs";

const prisma = new PrismaClient();

const sections = [
  { name: "Дамско", slug: "women", eyebrow: "ДАМСКА МОДА", description: "Елегантни и ежедневни модели.", baseAudience: "WOMEN", isSystem: true, sortOrder: 10 },
  { name: "Мъжко", slug: "men", eyebrow: "МЪЖКА МОДА", description: "Изчистени и удобни мъжки модели.", baseAudience: "MEN", isSystem: true, sortOrder: 20 },
  { name: "Детско", slug: "kids", eyebrow: "ДЕТСКА МОДА", description: "Практични предложения за деца.", baseAudience: "KIDS", isSystem: true, sortOrder: 30 },
];

const categories = [
  { name: "Рокли", slug: "dresses", sectionSlug: "women" },
  { name: "Тениски и блузи", slug: "tops", sectionSlug: "women" },
  { name: "Панталони", slug: "trousers", sectionSlug: "men" },
  { name: "Комплекти", slug: "sets", sectionSlug: "women" },
  { name: "Детски дрехи", slug: "kids-clothes", sectionSlug: "kids" },
  { name: "Обувки", slug: "shoes", sectionSlug: "women" },
  { name: "Аксесоари", slug: "accessories", sectionSlug: "women" },
];

const products = [
  {
    categorySlug: "dresses",
    name: "Елегантна бордо рокля",
    slug: "elegantna-bordo-roklya",
    description: "Елегантна дамска рокля с изчистен силует и меко падане.",
    price: 119,
    compareAtPrice: 149,
    imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=86",
    audience: "WOMEN",
    isNew: true,
    isFeatured: true,
    stock: 12,
    sortOrder: 10,
  },
  {
    categorySlug: "tops",
    name: "Дамска сатенена блуза",
    slug: "damska-satenena-bluza",
    description: "Лека сатенена блуза за ежедневна и официална визия.",
    price: 69,
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=86",
    audience: "WOMEN",
    isNew: true,
    isFeatured: true,
    stock: 18,
    sortOrder: 20,
  },
  {
    categorySlug: "tops",
    name: "Мъжка памучна тениска",
    slug: "mazhka-pamuchna-teniska",
    description: "Плътна памучна тениска с комфортна права кройка.",
    price: 44,
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=86",
    audience: "MEN",
    isNew: true,
    isFeatured: true,
    stock: 25,
    sortOrder: 30,
  },
  {
    categorySlug: "trousers",
    name: "Мъжки класически панталон",
    slug: "mazhki-klasicheski-pantalon",
    description: "Класически мъжки панталон с модерна стеснена линия.",
    price: 89,
    compareAtPrice: 109,
    imageUrl: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=1200&q=86",
    audience: "MEN",
    isNew: false,
    isFeatured: true,
    stock: 9,
    sortOrder: 40,
  },
  {
    categorySlug: "kids-clothes",
    name: "Детски летен комплект",
    slug: "detski-leten-komplekt",
    description: "Удобен комплект от мека материя за активни летни дни.",
    price: 49,
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=1200&q=86",
    audience: "KIDS",
    isNew: true,
    isFeatured: true,
    stock: 16,
    sortOrder: 50,
  },
  {
    categorySlug: "kids-clothes",
    name: "Детска празнична рокля",
    slug: "detska-praznichna-roklya",
    description: "Нежна детска рокля за празници и специални поводи.",
    price: 75,
    compareAtPrice: 95,
    imageUrl: "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=1200&q=86",
    audience: "KIDS",
    isNew: false,
    isFeatured: true,
    stock: 7,
    sortOrder: 60,
  },
];

for (const section of sections) {
  await prisma.catalogSection.upsert({
    where: { slug: section.slug },
    update: { ...section },
    create: section,
  });
}

for (const category of categories) {
  const section = await prisma.catalogSection.findUnique({ where: { slug: category.sectionSlug } });
  const { sectionSlug, ...data } = category;
  if (!section) throw new Error(`Missing catalog section: ${category.sectionSlug}`);
  await prisma.category.upsert({
    where: { sectionId_slug: { sectionId: section.id, slug: data.slug } },
    update: { name: data.name },
    create: { ...data, sectionId: section.id },
  });
}

for (const product of products) {
  const category = await prisma.category.findFirst({ where: { slug: product.categorySlug } });
  if (!category) throw new Error(`Missing category: ${product.categorySlug}`);

  const data = { ...product };
  delete data.categorySlug;

  const section = await prisma.catalogSection.findFirst({ where: { baseAudience: data.audience, isActive: true }, orderBy: { sortOrder: "asc" } });
  const savedProduct = await prisma.product.upsert({
    where: { slug: data.slug },
    update: { ...data, categoryId: category.id, sectionId: category.sectionId ?? section?.id ?? null },
    create: { ...data, categoryId: category.id, sectionId: category.sectionId ?? section?.id ?? null },
  });

  const sizes =
    data.audience === "WOMEN"
      ? ["EU 36", "EU 38", "EU 40", "EU 42"]
      : data.audience === "MEN"
        ? ["EU S", "EU M", "EU L", "EU XL"]
        : ["EU 116", "EU 128", "EU 140", "EU 152"];

  const baseStock = Math.floor(data.stock / sizes.length);
  const remainder = data.stock % sizes.length;

  for (const [index, size] of sizes.entries()) {
    await prisma.productVariant.upsert({
      where: {
        productId_size: { productId: savedProduct.id, size },
      },
      update: {
        stock: baseStock + (index < remainder ? 1 : 0),
        isActive: true,
      },
      create: {
        productId: savedProduct.id,
        size,
        stock: baseStock + (index < remainder ? 1 : 0),
        isActive: true,
      },
    });
  }
}

await ensureTestAdmin(prisma, { logger: console });
console.log("Public demo базата е заредена с начални категории, продукти, размери и test admin.");
await prisma.$disconnect();
