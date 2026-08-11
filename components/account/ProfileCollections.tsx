"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { announceCartUpdate } from "@/lib/cart-events";
import { announceFavoritesUpdate } from "@/lib/favorite-events";
import styles from "./ProfileCollections.module.css";

type FavoriteItem = {
  favoriteId: number;
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

function money(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function ProfileCollections() {
  const [favorites, setFavorites] = useState<FavoriteItem[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/favorites", { cache: "no-store" }),
      fetch("/api/history", { cache: "no-store" }),
    ])
      .then(async ([favoritesResponse, historyResponse]) => {
        if (
          favoritesResponse.status === 401 ||
          historyResponse.status === 401
        ) {
          location.href = "/login?next=/account";
          return;
        }

        const favoritesData = await favoritesResponse.json();
        const historyData = await historyResponse.json();

        const nextFavorites = favoritesData.favorites ?? [];
        setFavorites(nextFavorites);
        announceFavoritesUpdate(nextFavorites);
        setHistory(historyData.history ?? []);
      })
      .catch(() => {
        setFavorites([]);
        setHistory([]);
      });
  }, []);

  async function moveFavoriteToCart(productId: number) {
    setMessage("");

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "Продуктът не беше добавен.");
      return;
    }

    announceCartUpdate(data);
    const favoritesResponse = await fetch(`/api/favorites?productId=${productId}`, {
      method: "DELETE",
    });
    if (favoritesResponse.ok) {
      const favoritesData = await favoritesResponse.json().catch(() => null);
      const nextFavorites = favoritesData?.favorites ?? [];
      setFavorites(nextFavorites);
      announceFavoritesUpdate(nextFavorites);
    }
    setMessage("Продуктът беше преместен в количката.");
  }

  async function removeFavorite(productId: number) {
    const response = await fetch(
      `/api/favorites?productId=${productId}`,
      { method: "DELETE" },
    );

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const nextFavorites = data?.favorites ?? [];
      setFavorites(nextFavorites);
      announceFavoritesUpdate(nextFavorites);
    }
  }

  async function clearHistory() {
    const response = await fetch("/api/history", {
      method: "DELETE",
    });

    if (response.ok) {
      setHistory([]);
    }
  }

  return (
    <div className={styles.wrapper}>
      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span>ЗАПАЗЕНО ЗА ПО-КЪСНО</span>
            <h2>Любими</h2>
          </div>

          <Link href="/favorites">
            Виж всички {favorites ? `(${favorites.length})` : ""}
          </Link>
        </div>

        {!favorites ? (
          <div className={styles.loading}>Зареждане на любими...</div>
        ) : favorites.length === 0 ? (
          <div className={styles.empty}>
            <p>Все още нямаш запазени любими артикули.</p>
            <Link href="/women">Разгледай продуктите</Link>
          </div>
        ) : (
          <div className={styles.favoriteGrid}>
            {favorites.slice(0, 4).map(({ favoriteId, product }) => (
              <article key={favoriteId} className={styles.favoriteCard}>
                <Link
                  href={`/products/${product.slug}`}
                  className={styles.favoriteImage}
                >
                  <Image src={product.imageUrl} alt={product.name} width={480} height={600} sizes="(max-width: 700px) 50vw, 240px" />
                </Link>

                <div className={styles.favoriteInfo}>
                  <span>{product.categoryName}</span>
                  <Link href={`/products/${product.slug}`}>
                    {product.name}
                  </Link>
                  <strong>{money(product.price)}</strong>

                  <div className={styles.favoriteActions}>
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => moveFavoriteToCart(product.id)}
                    >
                      {product.stock > 0
                        ? "В количката"
                        : "Изчерпан"}
                    </button>

                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeFavorite(product.id)}
                    >
                      Премахни
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span>ПОСЛЕДНО РАЗГЛЕЖДАНИ</span>
            <h2>Хронология</h2>
          </div>

          <div className={styles.historyHeaderActions}>
            <Link href="/history">
              Виж всички {history ? `(${history.length})` : ""}
            </Link>

            {history && history.length > 0 && (
              <button type="button" onClick={clearHistory}>
                Изчисти
              </button>
            )}
          </div>
        </div>

        {!history ? (
          <div className={styles.loading}>Зареждане на хронологията...</div>
        ) : history.length === 0 ? (
          <div className={styles.empty}>
            <p>Все още няма разглеждани артикули.</p>
            <Link href="/new">Виж новите предложения</Link>
          </div>
        ) : (
          <div className={styles.historyList}>
            {history.slice(0, 6).map((item) => (
              <article key={item.historyId} className={styles.historyItem}>
                <Link href={`/products/${item.product.slug}`}>
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    width={160}
                    height={200}
                    sizes="96px"
                  />
                </Link>

                <div className={styles.historyInfo}>
                  <span>{item.product.categoryName}</span>
                  <Link href={`/products/${item.product.slug}`}>
                    {item.product.name}
                  </Link>
                  <strong>{money(item.product.price)}</strong>
                  <small>
                    Последно гледан:{" "}
                    {new Date(item.viewedAt).toLocaleString("bg-BG")}
                  </small>
                </div>

                <div className={styles.viewCount}>
                  <strong>{item.viewCount}</strong>
                  <span>
                    {item.viewCount === 1 ? "преглед" : "прегледа"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
