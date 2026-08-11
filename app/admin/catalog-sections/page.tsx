import CatalogStructureManager from "@/components/admin/CatalogStructureManager";
import { listAdminCatalogSections, listAdminCategoriesWithSections } from "@/lib/admin-catalog-structure";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function CatalogSectionsPage() {
  const [sections, categories] = await Promise.all([listAdminCatalogSections(), listAdminCategoriesWithSections()]);
  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>МАГАЗИН</span><h1>Секции / страници</h1><p>Секциите са реалните страници на магазина. Не са вързани към основна група.</p></div></div>
    <CatalogStructureManager initialSections={sections} initialCategories={categories} mode="sections" />
  </main>;
}
