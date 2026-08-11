"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { announceFavoritesUpdate } from "@/lib/favorite-events";
import styles from "./FavoriteButton.module.css";

type FavoriteApiItem = {
  product?: { id?: number };
};

export default function FavoriteButton({
  productId,
  initialFavorite = false,
  compact = false,
}: {
  productId: number;
  initialFavorite?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (loading) return;

    const wasFavorite = favorite;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        wasFavorite
          ? `/api/favorites?productId=${productId}`
          : "/api/favorites",
        {
          method: wasFavorite ? "DELETE" : "POST",
          headers: wasFavorite
            ? undefined
            : { "Content-Type": "application/json" },
          body: wasFavorite
            ? undefined
            : JSON.stringify({ productId }),
        },
      );

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        return;
      }

      if (!response.ok) {
        setError(data?.error ?? "Промяната в любими не беше запазена.");
        return;
      }

      const favorites = Array.isArray(data?.favorites)
        ? (data.favorites as FavoriteApiItem[])
        : null;
      const nextFavorite = favorites
        ? favorites.some((item) => item.product?.id === productId)
        : !wasFavorite;

      setFavorite(nextFavorite);
      announceFavoritesUpdate(data);
    } catch {
      setError("Няма връзка със сървъра. Опитай отново.");
    } finally {
      setLoading(false);
    }
  }

  const actionLabel = favorite ? "Премахни от любими" : "Добави в любими";

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compactWrapper : ""}`}>
      <button
        type="button"
        className={`${styles.button} ${
          favorite ? styles.active : ""
        } ${compact ? styles.compact : ""}`}
        aria-label={actionLabel}
        aria-pressed={favorite}
        title={actionLabel}
        disabled={loading}
        onClick={toggle}
      >
        <span aria-hidden="true">{favorite ? "♥" : "♡"}</span>
        {!compact && (
          <span className={styles.labels}>
            <strong>
              {loading
                ? "Запазване..."
                : favorite
                  ? "Добавено в любими"
                  : "Добави в любими"}
            </strong>
            {favorite && !loading && (
              <small>Натисни, за да премахнеш</small>
            )}
          </span>
        )}
      </button>
      {error && !compact && <p className={styles.error}>{error}</p>}
    </div>
  );
}
