import ProductAttributesManager from "@/components/admin/ProductAttributesManager";
import { listProductAttributes } from "@/lib/admin-product-attributes";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function ProductAttributesPage() {
  await requireAdminPermission("PRODUCTS:VIEW");
  const store = await listProductAttributes();
  return <main className={styles.main}>
    <div className={styles.titleRow}>
      <div>
        <span>МАГАЗИН</span>
        <h1>Продуктови стойности</h1>
        <p>Тук се управляват падащите менюта за тип продукт, цвят и материал.</p>
      </div>
    </div>
    <ProductAttributesManager initialStore={store} />
  </main>;
}
