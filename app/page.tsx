/* eslint-disable @next/next/no-img-element -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import Link from "next/link";
import DbProductCard from "@/components/DbProductCard";
import { getFeaturedProducts, getNewProducts } from "@/lib/catalog";
import { getSiteDesign, parseCustomHomeSections } from "@/lib/site-design";
import styles from "./page.module.css";
import HeroSlideshow from "@/components/HeroSlideshow";

export const dynamic = "force-dynamic";

type HomeSectionKey = "hero" | "benefits" | "categories" | "products";
const DEFAULT_ORDER: HomeSectionKey[] = ["hero", "benefits", "categories", "products"];


function parseHeroImages(designTokensJson: string, fallback: string): string[] {
  try {
    const tokens = JSON.parse(designTokensJson || "{}");
    const value = tokens?.["hero.images"];
    if (Array.isArray(value)) {
      const images = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4);
      if (images.length) return images;
    }
  } catch {}
  return fallback.trim() ? [fallback.trim()] : [];
}

function normalizeOrder(value: string): HomeSectionKey[] {
  const allowed = new Set<HomeSectionKey>(DEFAULT_ORDER);
  const parsed = value.split(",").map((item) => item.trim()).filter((item): item is HomeSectionKey => allowed.has(item as HomeSectionKey));
  return [...new Set([...parsed, ...DEFAULT_ORDER])];
}

export default async function Home() {
  const [featured, design] = await Promise.all([getFeaturedProducts(), getSiteDesign()]);
  const fallback = featured.length ? featured : await getNewProducts();
  const products = fallback.slice(0, 5);
  const benefits = [
    ["▱", design.benefitsTitle1, design.benefitsText1], ["↻", design.benefitsTitle2, design.benefitsText2],
    ["♢", design.benefitsTitle3, design.benefitsText3], ["✺", design.benefitsTitle4, design.benefitsText4],
  ];
  const customSections = parseCustomHomeSections(design.customSectionsJson);
  const heroImages = parseHeroImages(design.designTokensJson, design.heroImageUrl);
  const categories = [
    ["/women", design.womenTitle, design.womenDescription, design.womenImageUrl],
    ["/men", design.menTitle, design.menDescription, design.menImageUrl],
    ["/kids", design.kidsTitle, design.kidsDescription, design.kidsImageUrl],
  ];

  const sections: Record<HomeSectionKey, React.ReactNode> = {
    hero: design.showHero ? <HeroSlideshow
      images={heroImages}
      variantClass={styles[`hero_${design.heroVariant}`] ?? ""}
      eyebrow={design.heroEyebrow}
      title={design.heroTitle}
      description={design.heroDescription}
      buttonText={design.heroButtonText}
      buttonHref={design.heroButtonHref}
    /> : null,
    benefits: design.showBenefits ? <section className={styles.benefits}>{benefits.map(([icon,title,text]) => <div key={title}><b>{icon}</b><span><strong>{title}</strong><small>{text}</small></span></div>)}</section> : null,
    categories: design.showCategories ? <section className={styles.categories}>
      <div className={styles.sectionTitle}><span /><h2>{design.categoriesTitle}</h2><span /></div>
      <div className={`${styles.categoryGrid} ${styles[`categories_${design.categoriesVariant}`] ?? ""}`}>{categories.map(([href,title,description,image]) => <Link key={href} href={href} className={styles.categoryCard} style={{ "--category-image": `url("${image.replaceAll('"', '')}")` } as React.CSSProperties}><div><h3>{title}</h3><p>{description}</p><b>{design.categoryButtonText.trim()} →</b></div></Link>)}</div>
    </section> : null,
    products: design.showProducts ? <section className={styles.productsSection}><div className={styles.productsHeading}><h2>{design.productsTitle}</h2><Link href="/new">{design.productsLinkText.trim()} →</Link></div>
      {products.length ? <div className={`${styles.productsGrid} ${styles[`products_${design.productsVariant}`] ?? ""}`}>{products.map((product) => <DbProductCard key={product.id} product={product} />)}</div> : <div className={styles.empty}>Добави продукти от администраторския панел.</div>}
    </section> : null,
  };

  return <>
    <main className={styles.main}>
    {normalizeOrder(design.homepageSectionOrder).map((key) => <div key={key} className={styles.layoutSection}>{sections[key]}</div>)}
    {customSections.filter((section) => section.enabled).map((section) => <section key={section.id} className={`${styles.customSection} ${styles[`customSection_${section.type}`] ?? ""} ${styles[`align_${section.alignment}`] ?? ""}`} style={{ "--custom-image": section.imageUrl ? `url("${section.imageUrl.replaceAll('"', '')}")` : "none" } as React.CSSProperties}>
      <div className={styles.customSectionShade} />
      <div className={styles.customSectionContent}>
        <span>{section.type === "promo" ? "СПЕЦИАЛНО ПРЕДЛОЖЕНИЕ" : section.type === "imageText" ? "ОТ НАС" : section.type === "faq" ? "ПОМОЩ" : section.type === "testimonials" ? "ОТЗИВИ" : section.type === "brands" ? "ПАРТНЬОРИ" : ""}</span>
        <h2>{section.title}</h2>
        {section.text && <p>{section.text}</p>}
        {section.type === "faq" ? <div className={styles.faqList}>{(section.items ?? []).map((item) => <details key={item.id}><summary>{item.title}</summary><p>{item.text}</p></details>)}</div> : null}
        {section.type === "testimonials" ? <div className={styles.testimonialGrid}>{(section.items ?? []).map((item) => <article key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">“</span>}<blockquote>{item.text}</blockquote><b>{item.title}</b></article>)}</div> : null}
        {section.type === "brands" ? <div className={styles.brandGrid}>{(section.items ?? []).map((item) => <Link key={item.id} href={item.href || "/"}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" /> : <b>{item.title}</b>}</Link>)}</div> : null}
        {!["text","faq","testimonials","brands"].includes(section.type) && section.buttonText && <Link href={section.buttonHref || "/"}>{section.buttonText} <b>→</b></Link>}
      </div>
    </section>)}
    </main>
  </>;
}
