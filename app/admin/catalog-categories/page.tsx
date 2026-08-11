import CatalogStructureManager from "@/components/admin/CatalogStructureManager";
import { listAdminCatalogSections, listAdminCategoriesWithSections } from "@/lib/admin-catalog-structure";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function CatalogCategoriesPage() {
  await requireAdminPermission("PRODUCTS:VIEW");
  const [sections, categories] = await Promise.all([listAdminCatalogSections(), listAdminCategoriesWithSections()]);
  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>МАГАЗИН</span><h1>Категории / филтри</h1><p>Категориите са филтри вътре в секциите, а не отделни страници.</p></div></div>
    <CatalogStructureManager initialSections={sections} initialCategories={categories} mode="categories" />
  </main>;
}
