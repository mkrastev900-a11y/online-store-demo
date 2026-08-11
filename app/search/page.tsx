import DbProductCard from "@/components/DbProductCard";
import { prisma } from "@/lib/prisma";
import styles from "./search.module.css";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const products = query
    ? await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { brand: { contains: query } },
            { category: { name: { contains: query } } },
          ],
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: { orderBy: { size: "asc" } },
          images: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 50,
      })
    : [];

  return (
    <>
      <main className={styles.main}>
        <span className={styles.eyebrow}>ТЪРСЕНЕ</span>
        <h1>{query ? `Резултати за „${query}“` : "Търси продукти"}</h1>
        {!query ? (
          <p>Въведи име, марка или категория в полето за търсене.</p>
        ) : products.length ? (
          <div className={styles.grid}>
            {products.map((product) => (
              <DbProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  description: product.description,
                  price: Number(product.price),
                  compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
                  imageUrl: product.imageUrl,
                  sectionSlug: null,
                  sectionName: null,
                  categorySlug: product.category.slug,
                  categoryName: product.category.name,
                  audience: product.audience,
                  isNew: product.isNew,
                  isFeatured: product.isFeatured,
                  sortOrder: product.sortOrder,
                  createdAt: product.createdAt.toISOString(),
                  stock: product.stock,
                  variants: product.variants.map((variant) => ({
                    id: variant.id,
                    size: variant.size,
                    stock: variant.stock,
                  })),
                  images: product.images.map((image) => ({
                    url: image.url,
                    alt: image.alt,
                    sortOrder: image.sortOrder,
                  })),
                }}
              />
            ))}
          </div>
        ) : (
          <p>Няма намерени продукти.</p>
        )}
      </main>
    </>
  );
}
