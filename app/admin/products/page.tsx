import Link from "next/link";
import ProductTable from "@/components/admin/ProductTable";
import { listAdminProducts } from "@/lib/admin-products";
import { getAdminUser } from "@/lib/admin";
import { hasAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = await getAdminUser();
  const [products, canCreate, canEdit, canDelete] = await Promise.all([
    listAdminProducts(),
    admin ? hasAdminPermission(admin.id, admin.role, "PRODUCTS:CREATE") : false,
    admin ? hasAdminPermission(admin.id, admin.role, "PRODUCTS:EDIT") : false,
    admin ? hasAdminPermission(admin.id, admin.role, "PRODUCTS:DELETE") : false,
  ]);

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>КАТАЛОГ</span>
          <h1>Продукти</h1>
        </div>

        {canCreate ? <Link href="/admin/products/new">
          Добави продукт
        </Link> : null}
      </div>

      <ProductTable products={products} canEdit={canEdit} canDelete={canDelete} />
    </main>
  );
}
