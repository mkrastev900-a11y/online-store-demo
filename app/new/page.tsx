import CatalogPage from "@/components/CatalogPage";
import { getSiteDesign } from "@/lib/site-design";
import { pageContent } from "@/lib/page-content";
import { getNewProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [products, design] = await Promise.all([getNewProducts(), getSiteDesign()]);
  const content = pageContent(design, "new");
  return <CatalogPage eyebrow={content.eyebrow} title={content.title} description={content.description} products={products} />;
}
