import type { Metadata } from "next";
import StoreShell from "@/components/StoreShell";
import ThemeInitializer from "@/components/ThemeInitializer";
import I18nProvider from "@/components/i18n/I18nProvider";
import VisualEditorPreviewReady from "@/components/VisualEditorPreviewReady";
import DemoModeNotice from "@/components/DemoModeNotice";
import { designCss, getSiteDesign } from "@/lib/site-design";
import { getLegalSettings } from "@/lib/legal-settings";
import { resolvePublicContactEmails } from "@/lib/contact-config";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getSession } from "@/lib/session";
import { findPublicUserById } from "@/lib/auth-db";
import { maybeCleanupExpiredDemoData } from "@/lib/demo-opportunistic-cleanup";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const design = await getSiteDesign();
  const siteUrl = getPublicSiteUrl();
  const canonical = design.seoCanonicalUrl.trim() || siteUrl;
  const configuredOgImage = design.seoOgImageUrl.trim();
  const ogImage = configuredOgImage || undefined;
  const keywords = design.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean);

  return {
    metadataBase: new URL(siteUrl),
    title: design.seoTitle || `${design.brandName} | ${design.tagline}`,
    description: design.seoDescription || design.heroDescription,
    keywords,
    alternates: canonical ? { canonical } : undefined,
    icons: design.faviconUrl ? { icon: design.faviconUrl } : undefined,
    robots: { index: design.seoIndex, follow: design.seoFollow },
    openGraph: {
      type: "website",
      title: design.seoTitle || design.brandName,
      description: design.seoDescription || design.heroDescription,
      siteName: design.brandName,
      url: canonical,
      images: ogImage ? [{
        url: ogImage,
        width: 1200,
        height: 630,
        alt: design.seoTitle || design.brandName,
      }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: design.seoTitle || design.brandName,
      description: design.seoDescription || design.heroDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await maybeCleanupExpiredDemoData();
  const design = await getSiteDesign();
  const legal = await getLegalSettings();
  const contactEmails = resolvePublicContactEmails({
    office: legal.contactEmail,
    support: legal.complaintsEmail,
  });
  const session = await getSession();
  const initialUser = session ? await findPublicUserById(session.userId) : null;
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: designCss(design) }} />
      </head>
      <body>
        <DemoModeNotice />
        <ThemeInitializer />
        <I18nProvider>
          <StoreShell contactEmails={contactEmails} initialUser={initialUser} initialDesign={{
            brandName: design.brandName,
            tagline: design.tagline,
            logoUrl: design.logoUrl,
            darkLogoUrl: design.darkLogoUrl,
            navigationItemsJson: design.navigationItemsJson,
            designTokensJson: design.designTokensJson || "{}",
            footerEyebrow: design.footerEyebrow,
            footerTitle: design.footerTitle,
            footerDescription: design.footerDescription,
            footerAbout: design.footerAbout,
            footerShopTitle: design.footerShopTitle,
            footerHelpTitle: design.footerHelpTitle,
            footerSocialTitle: design.footerSocialTitle,
            footerCopyright: design.footerCopyright,
            instagramUrl: design.instagramUrl,
            facebookUrl: design.facebookUrl,
            tiktokUrl: design.tiktokUrl,
          }}>{children}</StoreShell>
          <VisualEditorPreviewReady />
        </I18nProvider>
      </body>
    </html>
  );
}
