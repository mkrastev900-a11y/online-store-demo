"use client";

import { useMemo, useState } from "react";
import CatalogExplorer from "@/components/CatalogExplorer";
import type { Product } from "@/lib/catalog";
import styles from "./KidsCatalogPage.module.css";

type KidsGroup = "all" | "girls" | "boys";

type Props = {
  sharedProducts: Product[];
  girlsProducts: Product[];
  boysProducts: Product[];};

function uniqueProducts(products: Product[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

export default function KidsCatalogPage({
  sharedProducts,
  girlsProducts,
  boysProducts,
}: Props) {
  const [group, setGroup] = useState<KidsGroup>("all");

  const products = useMemo(() => {
    if (group === "girls") return uniqueProducts([...sharedProducts, ...girlsProducts]);
    if (group === "boys") return uniqueProducts([...sharedProducts, ...boysProducts]);
    return uniqueProducts([...sharedProducts, ...girlsProducts, ...boysProducts]);
  }, [group, sharedProducts, girlsProducts, boysProducts]);

  return (
    <>
      <main className={styles.main}>
        {(
          <section className={styles.heading}>
            <span>ДЕТСКА МОДА</span>
            <h1>Детско</h1>
            <p>Подбрани предложения за момичета и момчета.</p>
          </section>
        )}

        <section className={styles.selectorSection} aria-label="Избор на детска колекция">
          <div className={styles.selectorIntro}>
            <span>ИЗБЕРИ КОЛЕКЦИЯ</span>
            <h2>Мода за всяко дете</h2>
            <p>Разгледай всички предложения или избери колекция за момичета или момчета.</p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Детски колекции">
            <button
              type="button"
              role="tab"
              aria-selected={group === "all"}
              className={group === "all" ? styles.activeTab : ""}
              onClick={() => setGroup("all")}
            >
              <span className={styles.tabIcon}>✦</span>
              <span><strong>Всички</strong><small>{uniqueProducts([...sharedProducts, ...girlsProducts, ...boysProducts]).length} продукта</small></span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={group === "girls"}
              className={group === "girls" ? styles.activeTab : ""}
              onClick={() => setGroup("girls")}
            >
              <span className={styles.tabIcon}>♡</span>
              <span><strong>За момичета</strong><small>{uniqueProducts([...sharedProducts, ...girlsProducts]).length} продукта</small></span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={group === "boys"}
              className={group === "boys" ? styles.activeTab : ""}
              onClick={() => setGroup("boys")}
            >
              <span className={styles.tabIcon}>◇</span>
              <span><strong>За момчета</strong><small>{uniqueProducts([...sharedProducts, ...boysProducts]).length} продукта</small></span>
            </button>
          </div>
        </section>

        <CatalogExplorer key={group} products={products} />
      </main>
    </>
  );
}
