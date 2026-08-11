"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

import Header from "@/components/Header";
import UniversalTextOverrides from "@/components/UniversalTextOverrides";
import { Footer } from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import MarketingPixelManager from "@/components/MarketingPixelManager";
import { ContactConfigProvider } from "@/components/ContactConfigProvider";
import { isStorefrontPath } from "@/lib/navigation";
import type { PublicContactEmails } from "@/lib/contact-config";

import styles from "./StoreShell.module.css";

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
};

type InitialStoreDesign = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  darkLogoUrl: string;
  navigationItemsJson?: string;
  designTokensJson: string;
  footerEyebrow: string;
  footerTitle: string;
  footerDescription: string;
  footerAbout: string;
  footerShopTitle: string;
  footerHelpTitle: string;
  footerSocialTitle: string;
  footerCopyright: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
};

export default function StoreShell({ children, contactEmails, initialDesign, initialUser }: { children: React.ReactNode; contactEmails: PublicContactEmails; initialDesign: InitialStoreDesign; initialUser: CurrentUser | null }) {
  const pathname = usePathname();

  if (!isStorefrontPath(pathname)) return <ContactConfigProvider emails={contactEmails}>{children}</ContactConfigProvider>;

  return (
    <ContactConfigProvider emails={contactEmails}>
      <div className={styles.storefrontRoot} data-storefront-root>
        <UniversalTextOverrides designTokensJson={initialDesign.designTokensJson} />
        <Header initialSiteBrand={initialDesign} initialUser={initialUser} />
        <div key={pathname} className={styles.routeScene}>
          {children}
        </div>
        <Footer initialDesign={initialDesign} />
        <CookieConsent />
        <Suspense fallback={null}>
          <MarketingPixelManager />
        </Suspense>
      </div>
    </ContactConfigProvider>
  );
}
