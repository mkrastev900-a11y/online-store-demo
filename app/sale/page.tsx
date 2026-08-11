import CatalogPage from "@/components/CatalogPage";
import { getSiteDesign } from "@/lib/site-design";
import { pageContent } from "@/lib/page-content";
import { getSaleProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [products, design] = await Promise.all([getSaleProducts(), getSiteDesign()]);
  const content = pageContent(design, "sale");
  return <CatalogPage eyebrow={content.eyebrow} title={content.title} description={content.description} products={products} />;
}
