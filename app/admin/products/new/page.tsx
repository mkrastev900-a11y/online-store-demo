import ProductForm from "@/components/admin/ProductForm";
import { getAdminCategories, getAdminSections } from "@/lib/admin-products";
import { getActiveProductAttributes } from "@/lib/admin-product-attributes";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categories, sections, attributes] = await Promise.all([getAdminCategories(), getAdminSections(), getActiveProductAttributes()]);

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>НОВ АРТИКУЛ</span>
          <h1>Добави продукт</h1>
        </div>
      </div>

      <ProductForm categories={categories} sections={sections} attributes={attributes} />
    </main>
  );
}
