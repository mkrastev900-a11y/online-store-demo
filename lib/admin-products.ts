/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { Audience, Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getStoredProductSectionId,
  listAdminCatalogSections,
  listAdminCategoriesWithSections,
  setStoredProductSectionId,
} from "@/lib/admin-catalog-structure";
import { deleteCloudinaryImages } from "@/lib/cloudinary";
import {
  createUniqueProductSku,
  createUniqueProductSlug,
  createVariantSku,
} from "@/lib/product-identifiers";

function sectionData(input: AdminProductInput) {
  // Product.sectionId вече съществува в схемата и трябва да е основният
  // източник на истина за позиционирането на продукта. Локалният JSON
  // остава само като обратна съвместимост за стари среди.
  return { sectionId: input.sectionId ?? null };
}

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  material: true,
  materialComposition: true,
  color: true,
  brand: true,
  categoryId: true,
  sectionId: true,
  audience: true,
  productType: true,
  productKind: true,
  price: true,
  compareAtPrice: true,
  imageUrl: true,
  isNew: true,
  isFeatured: true,
  isActive: true,
  stock: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  sizeGuideId: true,
  hasCustomSizing: true,
  customSizeGuide: true,
  category: { select: { id: true, name: true, slug: true, sectionId: true } },
  section: { select: { id: true, name: true, slug: true, baseAudience: true } },
  variants: {
    where: { isActive: true },
    orderBy: { size: "asc" as const },
  },
  images: { orderBy: { sortOrder: "asc" as const } },
};

async function safeFindCategories() {
  try {
    return await (prisma.category as any).findMany({
      select: { id: true, name: true, slug: true, sectionId: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return (prisma.category as any).findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }
}

export type AdminVariantInput = {
  size: string;
  stock: number;
};

export type AdminProductInput = {
  sectionId?: number | null;
  name: string;
  description: string;
  material?: string | null;
  materialComposition?: Prisma.InputJsonValue | null;
  color?: string | null;
  brand?: string | null;
  categoryId: number;
  audience: Audience;
  productType: ProductType;
  productKind?: string | null;
  price: number;
  compareAtPrice?: number | null;
  imageUrls: string[];
  variants: AdminVariantInput[];
  isNew: boolean;
  isFeatured: boolean;
  isActive: boolean;
  sizeGuideId?: number | null;
  hasCustomSizing?: boolean;
  customSizeGuide?: Prisma.InputJsonValue | null;
};

export async function listAdminProducts() {
  const products: any[] = await (prisma.product as any).findMany({
    select: adminProductSelect,
    orderBy: { createdAt: "desc" },
  });
  return products.map((product: any) => ({
    ...product,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
  }));
}

export async function getAdminProduct(id: number) {
  const product = await (prisma.product as any).findUnique({
    where: { id },
    select: adminProductSelect,
  });
  return product ? {
    ...product,
    sectionId:
      product.sectionId
      ?? product.section?.id
      ?? getStoredProductSectionId(product.id)
      ?? product.category?.sectionId
      ?? null,
    productKind: product.productKind ?? null,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
  } : null;
}

export async function getAdminCategories() {
  return listAdminCategoriesWithSections();
}

export async function getAdminSections() {
  return listAdminCatalogSections();
}

async function assertCategoryBelongsToSection(categoryId: number, sectionId?: number | null) {
  if (!sectionId) throw new Error("Избери секция за продукта.");
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, sectionId: true, name: true },
  });
  if (!category) throw new Error("Избраната категория не съществува.");
  if (category.sectionId !== sectionId) {
    throw new Error(`Категорията „${category.name}“ не принадлежи към избраната секция.`);
  }
}

function assertUniqueVariantSizes(variants: AdminVariantInput[]) {
  const normalized = variants.map((variant) => variant.size.trim().toLocaleLowerCase("bg-BG"));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Един и същ размер е добавен повече от веднъж.");
  }

  // Different labels such as "S/M" and "SM" normalize to the same SKU suffix.
  // Reject them before writing so ProductVariant.sku remains a real unique identifier.
  const skuSuffixes = variants.map((variant) => createVariantSku("BASE", variant.size));
  if (new Set(skuSuffixes).size !== skuSuffixes.length) {
    throw new Error("Два размера генерират един и същ SKU код. Промени означението на единия размер.");
  }
}

export async function createAdminProduct(input: AdminProductInput) {
  await assertCategoryBelongsToSection(input.categoryId, input.sectionId);
  assertUniqueVariantSizes(input.variants);
  const [slug, sku] = await Promise.all([
    createUniqueProductSlug(input.name),
    createUniqueProductSku(input.audience),
  ]);

  const totalStock = input.variants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );

  const product = await prisma.product.create({
    data: {
      name: input.name,
      slug,
      sku,
      description: input.description,
      material: input.material || null,
      materialComposition: input.materialComposition ?? Prisma.JsonNull,
      color: input.color || null,
      brand: input.brand || null,
      ...sectionData(input),
      categoryId: input.categoryId,
      audience: input.audience,
      productType: input.productType,
      productKind: input.productKind?.trim() || null,
      price: input.price,
      compareAtPrice: input.compareAtPrice || null,
      imageUrl: input.imageUrls[0],
      stock: totalStock,
      isNew: input.isNew,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      sizeGuideId: input.hasCustomSizing ? null : (input.sizeGuideId || null),
      hasCustomSizing: Boolean(input.hasCustomSizing),
      customSizeGuide: input.hasCustomSizing && input.customSizeGuide ? input.customSizeGuide : Prisma.JsonNull,
      images: {
        create: input.imageUrls.map((url, index) => ({
          url,
          alt: input.name,
          sortOrder: index,
        })),
      },
      variants: {
        create: input.variants.map((variant) => ({
          size: variant.size,
          stock: variant.stock,
          sku: createVariantSku(sku, variant.size),
        })),
      },
    },
    select: adminProductSelect,
  });

  setStoredProductSectionId(product.id, input.sectionId ?? null);
  return product;
}

export async function updateAdminProduct(
  id: number,
  input: AdminProductInput,
) {
  await assertCategoryBelongsToSection(input.categoryId, input.sectionId);
  assertUniqueVariantSizes(input.variants);
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { sku: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true, sortOrder: true } } },
  });

  if (!existing) throw new Error("Продуктът не е намерен.");

  const productSku =
    existing.sku ?? (await createUniqueProductSku(input.audience));
  const slug = await createUniqueProductSlug(input.name, id);
  const totalStock = input.variants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const incomingImageUrls = input.imageUrls;
    const imageQueues = new Map<string, typeof existing.images>();
    for (const image of existing.images) {
      const queue = imageQueues.get(image.url) ?? [];
      queue.push(image);
      imageQueues.set(image.url, queue);
    }
    const matchedImageIds = new Set<number>();

    for (let index = 0; index < incomingImageUrls.length; index += 1) {
      const url = incomingImageUrls[index];
      const queue = imageQueues.get(url);
      const oldImage = queue?.shift();
      if (oldImage) {
        matchedImageIds.add(oldImage.id);
        if (oldImage.sortOrder !== index || oldImage.alt !== input.name) {
          await tx.productImage.update({
            where: { id: oldImage.id },
            data: { sortOrder: index, alt: input.name },
          });
        }
      } else {
        await tx.productImage.create({
          data: { productId: id, url, alt: input.name, sortOrder: index },
        });
      }
    }

    const removedImageIds = existing.images.filter((image) => !matchedImageIds.has(image.id)).map((image) => image.id);
    if (removedImageIds.length) {
      await tx.productImage.deleteMany({ where: { id: { in: removedImageIds }, productId: id } });
    }

    // Запазваме variant ID-тата, когато размерът вече съществува.
    const existingVariants = await tx.productVariant.findMany({
      where: { productId: id },
    });

    const incomingSizes = new Set(input.variants.map((v) => v.size));
    const removedVariantIds = existingVariants
      .filter((variant) => !incomingSizes.has(variant.size))
      .map((variant) => variant.id);

    // Вариантите могат да участват в поръчки, резервации и стокови трансфери.
    // Физическото им изтриване нарушава RESTRICT външните ключове и блокира
    // записването на целия продукт. Затова премахнатите от формата размери се
    // деактивират и зануляват, като историческите връзки остават валидни.
    if (removedVariantIds.length > 0) {
      await tx.productVariant.updateMany({
        where: { id: { in: removedVariantIds } },
        data: { isActive: false, stock: 0 },
      });
    }

    for (const variant of input.variants) {
      const old = existingVariants.find((v) => v.size === variant.size);

      if (old) {
        await tx.productVariant.update({
          where: { id: old.id },
          data: {
            stock: variant.stock,
            sku: createVariantSku(productSku, variant.size),
            isActive: true,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId: id,
            size: variant.size,
            stock: variant.stock,
            sku: createVariantSku(productSku, variant.size),
          },
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        sku: productSku,
        description: input.description,
        material: input.material || null,
        materialComposition: input.materialComposition ?? Prisma.JsonNull,
        color: input.color || null,
        brand: input.brand || null,
        ...sectionData(input),
        categoryId: input.categoryId,
        audience: input.audience,
        productType: input.productType,
        productKind: input.productKind?.trim() || null,
        price: input.price,
        compareAtPrice: input.compareAtPrice || null,
        imageUrl: input.imageUrls[0],
        stock: totalStock,
        isNew: input.isNew,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
        sizeGuideId: input.hasCustomSizing ? null : (input.sizeGuideId || null),
        hasCustomSizing: Boolean(input.hasCustomSizing),
        customSizeGuide: input.hasCustomSizing && input.customSizeGuide ? input.customSizeGuide : Prisma.JsonNull,
      },
      select: adminProductSelect,
    });
  });

  const kept = new Set(input.imageUrls);
  const removedUrls = existing.images.map((image) => image.url).filter((url) => !kept.has(url));
  try {
    await deleteCloudinaryImages(removedUrls);
  } catch (error) {
    console.error("Cloudinary cleanup after product update failed:", error);
  }

  setStoredProductSectionId(id, input.sectionId ?? null);
  return updated;
}

export async function deleteAdminProduct(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      images: { select: { url: true } },
      variants: { select: { id: true } },
      orderItems: { select: { id: true }, take: 1 },
    },
  });

  if (!product) throw new Error("Продуктът не е намерен.");

  const archiveProduct = async () => {
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          isActive: false,
          stock: 0,
          // Keep section/category integrity for historical products.
          // Archived products are hidden by isActive and must retain their canonical catalog relation.
          productKind: null,
        },
        select: { id: true },
      }),
      prisma.productVariant.updateMany({
        where: { productId: id },
        data: { isActive: false, stock: 0 },
      }),
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.favorite.deleteMany({ where: { productId: id } }),
    ]);

    return { deleted: false, archived: true };
  };

  // Продуктите, които вече участват в поръчки, складови трансфери
  // или друга историческа операция, не трябва да се изтриват физически.
  if (product.orderItems.length > 0) return archiveProduct();

  const variantIds = product.variants.map((variant) => variant.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.favorite.deleteMany({ where: { productId: id } });
      await tx.productView.deleteMany({ where: { productId: id } });

      if (variantIds.length > 0) {
        await tx.inventoryReservation.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.orderInventoryReservation.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
      }

      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id }, select: { id: true } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

    // В базата може да има запазена складова/счетоводна история от по-стари
    // модули. При RESTRICT връзка пазим историята и архивираме продукта.
    if (code === "P2003" || message.includes("foreign key constraint") || message.includes("violates RESTRICT")) {
      return archiveProduct();
    }

    throw error;
  }

  try {
    await deleteCloudinaryImages(product.images.map((image) => image.url));
  } catch (error) {
    console.error("Cloudinary cleanup after product deletion failed:", error);
  }

  // Не записваме повече в локални JSON файлове. Във Vercel файловата
  // система на приложението е read-only, а продуктът вече е изтрит от БД.
  return { deleted: true, archived: false };
}
