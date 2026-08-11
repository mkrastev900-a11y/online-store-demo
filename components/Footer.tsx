"use client";

import Link from "next/link";
import Image from "next/image";

import ContactEmailLink from "@/components/ContactEmailLink";
import { DEFAULT_STORE_NAME, DEFAULT_STORE_TAGLINE } from "@/lib/brand";
import styles from "./Footer.module.css";

type FooterDesign = {
  brandName: string;
  tagline: string;
  logoUrl: string;
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

const fallback: FooterDesign = {
  brandName: DEFAULT_STORE_NAME,
  tagline: DEFAULT_STORE_TAGLINE,
  logoUrl: "",
  footerEyebrow: "КЛУБ",
  footerTitle: "Първи научавай за новите предложения",
  footerDescription: "Абонирай се за новини, промоции и специални предложения.",
  footerAbout: "Качествени продукти, сигурно пазаруване и обслужване с внимание.",
  footerShopTitle: "Пазарувай",
  footerHelpTitle: "Помощ",
  footerSocialTitle: "Последвай ни",
  footerCopyright: "© 2026 Всички права запазени",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
};

export function Footer({ initialDesign }: { initialDesign?: Partial<FooterDesign> }) {
  const design: FooterDesign = { ...fallback, ...initialDesign };

  function openCookieSettings() {
    window.dispatchEvent(new Event("zlatevi-open-cookie-settings"));
  }

  const socialLinks = [
    { label: "Instagram", url: design.instagramUrl },
    { label: "Facebook", url: design.facebookUrl },
    { label: "TikTok", url: design.tiktokUrl },
  ].filter((item) => item.url.trim().length > 0);

  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.grid}`}>
        <div className={styles.brand}>
          {design.logoUrl ? (
            <Link className={styles.logo} href="/" aria-label={`${design.brandName} — начало`}>
              <Image src={design.logoUrl} alt={design.brandName} width={180} height={72} sizes="180px" />
            </Link>
          ) : (
            <strong>{design.brandName}</strong>
          )}
          <p>{design.footerAbout}</p>
        </div>

        <nav className={styles.column} aria-label={design.footerShopTitle}>
          <h3>{design.footerShopTitle}</h3>
          <Link href="/women">Дамско</Link>
          <Link href="/men">Мъжко</Link>
          <Link href="/kids">Детско</Link>
          <Link href="/new">Ново</Link>
        </nav>

        <nav className={styles.column} aria-label={design.footerHelpTitle}>
          <h3>{design.footerHelpTitle}</h3>
          <Link href="/contact">Контакти</Link>
          <ContactEmailLink purpose="office" />
          <Link href="/account">Профил</Link>
          <Link href="/cart">Количка</Link>
        </nav>

        <div className={styles.column}>
          <h3>{design.footerSocialTitle}</h3>
          {socialLinks.length > 0 ? (
            <div className={styles.socials}>
              {socialLinks.map((item) => (
                <a className={styles.socialLink} key={item.label} href={item.url} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ))}
            </div>
          ) : (
            <span>{design.tagline}</span>
          )}
        </div>
      </div>

      <div className={`${styles.shell} ${styles.bottom}`}>
        <span>{design.footerCopyright}</span>
        <div className={styles.legal}>
          <Link href="/terms">Общи условия</Link>
          <Link href="/privacy">Поверителност</Link>
          <Link href="/cookie-policy">Политика за бисквитки</Link>
          <button type="button" onClick={openCookieSettings}>Настройки на бисквитките</button>
        </div>
      </div>
    </footer>
  );
}
