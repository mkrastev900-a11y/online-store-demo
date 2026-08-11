"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { announceCartUpdate } from "@/lib/cart-events";
import { announceFavoritesUpdate } from "@/lib/favorite-events";
import styles from "./FavoritesClient.module.css";

type Favorite = {
  favoriteId: number;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
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

async function safeJson(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function FavoritesClient() {
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/favorites", {
      cache: "no-store",
    });

    if (response.status === 401) {
      location.href = "/login?next=/favorites";
      return;
    }

    const data = await safeJson(response);
    const favorites = data?.favorites ?? [];
    setItems(favorites);
    announceFavoritesUpdate(favorites);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function remove(productId: number) {
    const response = await fetch(
      `/api/favorites?productId=${productId}`,
      { method: "DELETE" },
    );

    if (response.ok) {
      const data = await safeJson(response);
      const favorites = data?.favorites ?? [];
      setItems(favorites);
      announceFavoritesUpdate(favorites);
    }
  }

  async function moveToCart(productId: number) {
    setMessage("");

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    const data = await safeJson(response) ?? {};

    if (!response.ok) {
      setMessage(data.error ?? "Продуктът не беше добавен.");
      return;
    }

    announceCartUpdate(data);
    await remove(productId);
    setMessage("Продуктът беше преместен в количката.");
  }

  if (!items) {
    return <div className={styles.notice}>Зареждане...</div>;
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Все още нямаш любими артикули</h2>
        <p>Запази продуктите, които искаш да разгледаш по-късно.</p>
        <Link href="/women">Разгледай продуктите</Link>
      </div>
    );
  }

  return (
    <>
      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.grid}>
        {items.map(({ favoriteId, product }) => (
          <article key={favoriteId} className={styles.card}>
            <Link href={`/products/${product.slug}`} className={styles.image}>
              <Image src={product.imageUrl} alt={product.name} width={480} height={600} sizes="(max-width: 700px) 100vw, 33vw" />
            </Link>

            <div className={styles.info}>
              <span>{product.categoryName}</span>
              <Link href={`/products/${product.slug}`}>
                {product.name}
              </Link>
              <strong>{money(product.price)}</strong>

              <div className={styles.actions}>
                <button
                  disabled={product.stock <= 0}
                  onClick={() => moveToCart(product.id)}
                >
                  {product.stock > 0
                    ? "Добави в количката"
                    : "Изчерпан"}
                </button>
                <button
                  className={styles.remove}
                  onClick={() => remove(product.id)}
                >
                  Премахни
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
