import { notFound } from "next/navigation";
import EditProductForm from "@/components/admin/EditProductForm";
import type { ManualSizeGuide } from "@/components/admin/ManualProductSizeGuideEditor";
import {
  getAdminCategories,
  getAdminProduct,
  getAdminSections,
} from "@/lib/admin-products";
import { getActiveProductAttributes } from "@/lib/admin-product-attributes";
import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId) || productId <= 0) {
    notFound();
  }

  const [product, categories, sections, attributes] = await Promise.all([
    getAdminProduct(productId),
    getAdminCategories(),
    getAdminSections(),
    getActiveProductAttributes(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>РЕДАКТИРАНЕ НА АРТИКУЛ</span>
          <h1>{product.name}</h1>
        </div>
      </div>

      <EditProductForm
        categories={categories}
        sections={sections}
        attributes={attributes}
        product={{
          ...product,
          customSizeGuide:
            product.customSizeGuide &&
            typeof product.customSizeGuide === "object" &&
            !Array.isArray(product.customSizeGuide)
              ? (product.customSizeGuide as unknown as ManualSizeGuide)
              : null,
        }}
      />
    </main>
  );
}
