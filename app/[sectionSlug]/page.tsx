import { notFound } from "next/navigation";
import CatalogPage from "@/components/CatalogPage";
import { getCatalogSectionBySlug, getProductsBySectionSlug } from "@/lib/catalog";
import { getSiteDesign } from "@/lib/site-design";
import { pageContent } from "@/lib/page-content";

export const dynamic = "force-dynamic";

const reserved = new Set(["admin", "api", "products", "cart", "checkout", "login", "register", "account", "favorites", "history", "search", "visual-editor", "about", "contact", "new", "sale", "brands", "order-success"]);

export default async function DynamicCatalogSectionPage({ params }: { params: Promise<{ sectionSlug: string }> }) {
  const { sectionSlug } = await params;
  if (reserved.has(sectionSlug)) notFound();
  const [section, products, design] = await Promise.all([getCatalogSectionBySlug(sectionSlug), getProductsBySectionSlug(sectionSlug), getSiteDesign()]);
  if (!section) notFound();
  const currentSection = section;
  const fallback = pageContent(design, "men");
  return <CatalogPage eyebrow={currentSection.eyebrow || fallback.eyebrow} title={currentSection.name} description={currentSection.description || fallback.description} products={products} />;
}
