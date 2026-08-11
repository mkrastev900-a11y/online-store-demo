import CatalogPage from "@/components/CatalogPage";
import { getSiteDesign } from "@/lib/site-design";
import { pageContent } from "@/lib/page-content";
import { getProductsByAudience, getProductsBySectionSlug, getCatalogSectionBySlug } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [sectionProducts, legacyProducts, section, design] = await Promise.all([getProductsBySectionSlug("men"), getProductsByAudience("MEN"), getCatalogSectionBySlug("men"), getSiteDesign()]);
  const content = pageContent(design, "men");
  const products = sectionProducts.length ? sectionProducts : legacyProducts;
  return <CatalogPage eyebrow={section?.eyebrow || content.eyebrow} title={section?.name || content.title} description={section?.description || content.description} products={products} />;
}
