import { prisma } from "@/lib/prisma";

const HISTORY_LIMIT = 50;

export async function recordProductView(
  userId: number,
  productId: number,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });

  if (!product) {
    return;
  }

  await prisma.productView.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    update: {
      viewedAt: new Date(),
      viewCount: { increment: 1 },
    },
    create: {
      userId,
      productId,
    },
  });

  const oldRows = await prisma.productView.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    skip: HISTORY_LIMIT,
    select: { id: true },
  });

  if (oldRows.length > 0) {
    await prisma.productView.deleteMany({
      where: {
        id: { in: oldRows.map((row) => row.id) },
      },
    });
  }
}

export async function getProductHistory(userId: number) {
  const rows = await prisma.productView.findMany({
    where: {
      userId,
      product: { isActive: true },
    },
    select: {
      id: true,
      viewedAt: true,
      viewCount: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          compareAtPrice: true,
          imageUrl: true,
          stock: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { viewedAt: "desc" },
    take: HISTORY_LIMIT,
  });

  return rows.map(({ id, viewedAt, viewCount, product }) => ({
    historyId: id,
    viewedAt,
    viewCount,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
      stock: product.stock,
      categoryName: product.category?.name ?? "",
    },
  }));
}

export async function clearProductHistory(userId: number) {
  await prisma.productView.deleteMany({
    where: { userId },
  });
}
