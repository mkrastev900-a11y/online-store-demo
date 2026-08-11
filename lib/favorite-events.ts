export type FavoriteSummary = {
  count: number;
};

export const FAVORITES_UPDATED_EVENT = "zlatevi-favorites-updated";
export const EMPTY_FAVORITE_SUMMARY: FavoriteSummary = { count: 0 };

export function toFavoriteSummary(value: unknown): FavoriteSummary {
  if (Array.isArray(value)) {
    return { count: value.length };
  }

  const data =
    value && typeof value === "object"
      ? (value as { count?: unknown; favorites?: unknown })
      : {};

  if (Array.isArray(data.favorites)) {
    return { count: data.favorites.length };
  }

  const count = Number(data.count);
  return {
    count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
  };
}

export function announceFavoritesUpdate(value: unknown) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<FavoriteSummary>(FAVORITES_UPDATED_EVENT, {
      detail: toFavoriteSummary(value),
    }),
  );
}
