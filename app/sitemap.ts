import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/new`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/sale`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/women`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/men`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/kids`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/cookie-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [products, sections] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.catalogSection.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }).catch(() => []),
    ]);

    for (const product of products) {
      entries.push({
        url: `${siteUrl}/products/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const section of sections) {
      if (!section.slug || ["women", "men", "kids"].includes(section.slug)) continue;
      entries.push({
        url: `${siteUrl}/${encodeURIComponent(section.slug)}`,
        lastModified: section.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // Keep the public static sitemap available even during a temporary DB issue.
  }

  return entries;
}
