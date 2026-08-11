import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";
import { getSiteDesign } from "@/lib/site-design";

export async function generateMetadata(): Promise<Metadata> {
  const design = await getSiteDesign();
  return {
    title: `Cookie Policy | ${design.brandName}`,
    description: "Информация за бисквитките и настройките за поверителност в онлайн магазина.",
  };
}

export default function CookiePolicyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Поверителност</span>
        <h1>Cookie Policy</h1>
        <p>
          Тази страница обяснява как сайтът използва бисквитки и подобни технологии. Целта е клиентът да знае какво се пази,
          защо се пази и как може да промени избора си.
        </p>
      </section>

      <section className={styles.card}>
        <h2>Какво са бисквитките?</h2>
        <p>
          Бисквитките са малки записи, които браузърът пази за сайта. Те могат да поддържат входа в профила, количката,
          настройките на интерфейса, статистика или рекламни предпочитания.
        </p>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Задължителни</h2>
          <p>
            Нужни са за основната работа на магазина — профил, количка, сигурност и запазване на избора за бисквитки. Те са
            винаги активни.
          </p>
        </article>
        <article className={styles.card}>
          <h2>Функционални</h2>
          <p>
            Помнят удобства като тъмен режим, визуални настройки и предпочитания в интерфейса.
          </p>
        </article>
        <article className={styles.card}>
          <h2>Аналитични</h2>
          <p>
            Използват се само след съгласие и помагат да се разбере как клиентите използват страниците и продуктите.
          </p>
        </article>
        <article className={styles.card}>
          <h2>Маркетинг</h2>
          <p>
            Използват се само след съгласие за рекламни пиксели, кампании и remarketing.
          </p>
        </article>
      </section>

      <section className={styles.card}>
        <h2>Как се променя изборът?</h2>
        <p>
          При първо посещение сайтът показва банер с избор. След като изборът бъде запазен, той се пази в браузъра. За да го
          промениш, изчисти бисквитките за сайта от настройките на браузъра и банерът ще се покаже отново.
        </p>
        <Link href="/" className={styles.backLink}>
          Обратно към магазина
        </Link>
      </section>
    </main>
  );
}
