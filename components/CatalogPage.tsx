import CatalogExplorer from "@/components/CatalogExplorer";
import type { Product } from "@/lib/catalog";
import styles from "./CatalogPage.module.css";

type Props = { eyebrow: string; title: string; description: string; products: Product[] };

export default function CatalogPage({ eyebrow, title, description, products }: Props) {
  return <>
    <main className={styles.main}>
      <section className={styles.heading}><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>
      <CatalogExplorer products={products} />
    </main>
  </>;
}
