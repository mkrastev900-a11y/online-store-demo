/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import RecordView from "@/components/history/RecordView";
import MarketingEventOnMount from "@/components/MarketingEventOnMount";
import ProductGallery from "@/components/ProductGallery";
import SizeGuideButton from "@/components/SizeGuideButton";
import { getProductBySlug } from "@/lib/catalog";
import { getVariantAddableQuantities } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import { isFavorite } from "@/lib/favorites";
import { getSession } from "@/lib/session";
import { getSiteDesign } from "@/lib/site-design";
import { getPublicSiteUrl } from "@/lib/site-url";
import styles from "./product.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [product, design] = await Promise.all([getProductBySlug(slug), getSiteDesign()]);
  if (!product) return { title: "Продуктът не е намерен" };

  const siteUrl = getPublicSiteUrl();
  const canonical = `${siteUrl}/products/${encodeURIComponent(product.slug)}`;
  const description = product.description.trim().slice(0, 160);

  return {
    title: `${product.name} | ${design.brandName}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: design.brandName,
      title: product.name,
      description,
      url: canonical,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : undefined,
    },
    twitter: {
      card: product.imageUrl ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}


export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const session = await getSession();
  const favorite = session ? await isFavorite(session.userId, product.id) : false;
  const addableByVariant = await getVariantAddableQuantities(session?.userId ?? null, product.variants);
  const variantsForCart = product.variants.map((variant) => ({
    ...variant,
    stock: addableByVariant.get(variant.id) ?? 0,
  }));
  const available = variantsForCart.reduce((sum, variant) => sum + variant.stock, 0);
  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  return (
    <>
      <RecordView productId={product.id} />
      <MarketingEventOnMount event="viewContent" payload={{ contentIds: [product.id], contentName: product.name, contentCategory: product.categoryName, value: product.price, currency: "EUR" }} />
      <main className={styles.main}>
        <div className={styles.breadcrumbs}>Начало / {product.categoryName} / {product.name}</div>
        <div className={styles.product}>
          <ProductGallery
            productName={product.name}
            isNew={product.isNew}
            images={[
              { url: product.imageUrl, alt: product.name },
              ...product.images.map((image) => ({
                url: image.url,
                alt: image.alt ?? product.name,
              })),
            ]}
          />

          <div className={styles.info}>
            <span className={styles.category}>{product.categoryName}</span>
            <h1>{product.name}</h1>
            <div className={styles.priceRow}>
              <strong>{formatPrice(product.price)}</strong>
              {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}
              {discount && <span>-{discount}%</span>}
            </div>
            <div className={styles.divider} />
            <p className={styles.description}>{product.description}</p>

            <div className={styles.stockLine}>
              <span className={available > 0 ? styles.stockDot : styles.outDot} />
              {available > 0 ? "В наличност" : "Изчерпано"}
            </div>

            {product.hasCustomSizing && product.customSizeGuide ? <SizeGuideButton guide={product.customSizeGuide as any} isCustom /> : product.sizeGuide ? <SizeGuideButton guide={product.sizeGuide} /> : null}

            <div className={styles.actions}>
              <AddToCartButton
                productId={product.id}
                variants={variantsForCart}
                className={styles.addButton}
                productName={product.name}
                productCategory={product.categoryName}
                price={product.price}
              />
              <FavoriteButton productId={product.id} initialFavorite={favorite} />
            </div>

            <div className={styles.assurances}>
              <div><strong>Безопасна поръчка</strong><span>Защитени лични данни</span></div>
              <div><strong>Лесно връщане</strong><span>Ясен процес при необходимост</span></div>
              <div><strong>Ограничени бройки</strong><span>Реална наличност по размер</span></div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
