import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/catalog";
import styles from "./DbProductCard.module.css";

function formatPrice(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function DbProductCard({ product }: { product: Product }) {
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(
          ((product.compareAtPrice - product.price) /
            product.compareAtPrice) *
            100,
        )
      : null;

  return (
    <article className={styles.card}>
      <Link href={`/products/${product.slug}`} className={styles.imageLink}>
        <Image
          src={product.imageUrl}
          alt={product.name}
          className={styles.image}
          width={640}
          height={800}
          sizes="(max-width: 600px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        <div className={styles.badges}>
          {product.isNew && <span className={styles.newBadge}>Ново</span>}
          {discount && (
            <span className={styles.saleBadge}>-{discount}%</span>
          )}
        </div>
      </Link>

      <div className={styles.content}>
        <span className={styles.category}>{product.categoryName}</span>
        <Link href={`/products/${product.slug}`} className={styles.title}>
          {product.name}
        </Link>

        <div className={styles.priceRow}>
          <strong>{formatPrice(product.price)}</strong>
          {product.compareAtPrice && (
            <del>{formatPrice(product.compareAtPrice)}</del>
          )}
        </div>
      </div>
    </article>
  );
}
