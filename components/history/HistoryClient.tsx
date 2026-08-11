"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./HistoryClient.module.css";

type HistoryItem = {
  historyId: number;
  viewedAt: string;
  viewCount: number;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    imageUrl: string;
    stock: number;
    categoryName: string;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export default function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  async function load() {
    const response = await fetch("/api/history", {
      cache: "no-store",
    });

    if (response.status === 401) {
      location.href = "/login?next=/history";
      return;
    }

    const data = await response.json();
    setItems(data.history ?? []);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function clear() {
    const response = await fetch("/api/history", {
      method: "DELETE",
    });

    if (response.ok) {
      setItems([]);
    }
  }

  if (!items) {
    return <div className={styles.notice}>Зареждане...</div>;
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Няма наскоро разглеждани артикули</h2>
        <Link href="/women">Към продуктите</Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <span>Показват се последните {items.length} от максимум 50 артикула.</span>
        <button onClick={clear}>Изчисти хронологията</button>
      </div>

      <div className={styles.list}>
        {items.map(({ historyId, viewedAt, viewCount, product }) => (
          <article key={historyId} className={styles.item}>
            <Link href={`/products/${product.slug}`}>
              <Image src={product.imageUrl} alt={product.name} width={160} height={200} sizes="96px" />
            </Link>

            <div className={styles.info}>
              <span>{product.categoryName}</span>
              <Link href={`/products/${product.slug}`}>
                {product.name}
              </Link>
              <strong>{money(product.price)}</strong>
              <small>
                Последно гледан:{" "}
                {new Date(viewedAt).toLocaleString("bg-BG")}
              </small>
            </div>

            <div className={styles.count}>
              <strong>{viewCount}</strong>
              <span>{viewCount === 1 ? "преглед" : "прегледа"}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
