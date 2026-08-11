import { prisma } from "@/lib/prisma";

export async function getFavorites(userId: number) {
  const rows = await prisma.favorite.findMany({
    where: {
      userId,
      product: { isActive: true },
    },
    select: {
      id: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          compareAtPrice: true,
          imageUrl: true,
          stock: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(({ id, createdAt, product }) => ({
    favoriteId: id,
    createdAt,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
      stock: product.stock,
      categoryName: product.category?.name ?? "",
    },
  }));
}

export async function getFavoriteCount(userId: number) {
  return prisma.favorite.count({
    where: {
      userId,
      product: { isActive: true },
    },
  });
}

export async function isFavorite(userId: number, productId: number) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
    select: { id: true },
  });

  return Boolean(favorite);
}

export async function addFavorite(userId: number, productId: number) {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });

  if (!product) {
    throw new Error("Продуктът не съществува.");
  }

  await prisma.favorite.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    update: {},
    create: { userId, productId },
  });

  return getFavorites(userId);
}

export async function removeFavorite(userId: number, productId: number) {
  await prisma.favorite.deleteMany({
    where: { userId, productId },
  });

  return getFavorites(userId);
}
