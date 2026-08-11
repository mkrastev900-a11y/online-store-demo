"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { announceCartUpdate } from "@/lib/cart-events";
import { trackMarketingEvent } from "@/components/MarketingPixelManager";

type Variant = {
  id: number;
  size: string;
  stock: number;
};

export default function AddToCartButton({
  productId,
  variants,
  className,
  productName,
  productCategory,
  price,
}: {
  productId: number;
  variants: Variant[];
  className?: string;
  productName?: string;
  productCategory?: string;
  price?: number;
}) {
  const router = useRouter();
  const [localVariants, setLocalVariants] = useState(() =>
    variants.map((variant) => ({
      ...variant,
      stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
    })),
  );
  const available = useMemo(
    () => localVariants.filter((variant) => variant.stock > 0),
    [localVariants],
  );
  const [variantId, setVariantId] = useState<number>(available[0]?.id ?? 0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const selectedVariant = localVariants.find((variant) => variant.id === variantId);
  const canAdd = Boolean(selectedVariant && selectedVariant.stock > 0);

  async function readJson(response: Response) {
    const text = await response.text().catch(() => "");
    if (!text.trim()) return {};
    try { return JSON.parse(text) as { error?: string; totalItems?: number; subtotal?: number }; } catch { return {}; }
  }

  function normalizeStockError(error?: string) {
    if (!error) return "Грешка.";
    if (error.includes("Налични за размер") || error.includes("Няма наличен") || error.includes("не е активен")) {
      return "Изчерпана наличност за избрания размер.";
    }
    return error;
  }

  async function add() {
    if (!variantId || !canAdd) {
      setMessage("Изчерпана наличност за избрания размер.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId, variantId, quantity: 1 }),
    });

    const data = await readJson(response);

    if (response.status === 401) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      setLoading(false);
      return;
    }

    if (response.ok) {
      setLocalVariants((current) => current.map((variant) => (
        variant.id === variantId
          ? { ...variant, stock: Math.max(0, variant.stock - 1) }
          : variant
      )));
      announceCartUpdate(data);
      trackMarketingEvent({ event: "addToCart", contentIds: [productId], contentName: productName, contentCategory: productCategory, value: price, currency: "EUR", quantity: 1 });
      setMessage("Добавено в количката.");
    } else {
      setMessage(normalizeStockError(data.error));
      if (data.error?.includes("Налични за размер") || data.error?.includes("Няма наличен")) {
        setLocalVariants((current) => current.map((variant) => (
          variant.id === variantId ? { ...variant, stock: 0 } : variant
        )));
      }
    }
    setLoading(false);
  }

  return (
    <div>
      <label>
        Размер
        <select
          value={variantId}
          onChange={(event) => setVariantId(Number(event.target.value))}
        >
          <option value={0}>Избери размер</option>
          {localVariants.map((variant) => (
            <option
              key={variant.id}
              value={variant.id}
              disabled={variant.stock <= 0}
            >
              {variant.size} — {variant.stock > 0 ? "в наличност" : "изчерпано"}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={className}
        disabled={loading || !canAdd}
        onClick={add}
      >
        {available.length === 0 || !canAdd
          ? "Изчерпана наличност"
          : loading
            ? "Добавяне..."
            : "Добави в количката"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}
