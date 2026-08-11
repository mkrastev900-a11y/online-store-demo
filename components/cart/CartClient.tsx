/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { announceCartUpdate } from "@/lib/cart-events";
import styles from "./CartClient.module.css";

type Item = {
  id: number;
  quantity: number;
  name: string;
  slug: string;
  price: number;
  imageUrl: string;
  size: string;
  productSku?: string | null;
  variantSku?: string | null;
  description?: string | null;
  material?: string | null;
  color?: string | null;
  availableStock: number;
  lineTotal: number;
};

type Cart = { items: Item[]; totalItems: number; subtotal: number };

const money = (value: number) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(value);

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function errorMessage(data: unknown, fallback: string) {
  return data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

function normalizeItem(item: Item): Item {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
  const price = Number(item.price) || 0;
  return {
    ...item,
    quantity,
    price,
    availableStock: Math.max(0, Math.floor(Number(item.availableStock) || 0)),
    lineTotal: price * quantity,
  };
}

function normalizeCart(cart: Cart): Cart {
  const items = Array.isArray(cart.items)
    ? cart.items.map(normalizeItem).filter((item) => item.quantity > 0)
    : [];
  return {
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

function readServerCart(data: unknown) {
  if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) return null;
  return normalizeCart(data as Cart);
}

export default function CartClient() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [busyQuantityItemIds, setBusyQuantityItemIds] = useState<number[]>([]);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  function updateBusyList(setter: Dispatch<SetStateAction<number[]>>, itemId: number, busy: boolean) {
    setter((current) => {
      const exists = current.includes(itemId);
      if (busy && !exists) return [...current, itemId];
      if (!busy && exists) return current.filter((id) => id !== itemId);
      return current;
    });
  }

  function setQuantityBusy(itemId: number, busy: boolean) {
    updateBusyList(setBusyQuantityItemIds, itemId, busy);
  }

  function setRemovingBusy(itemId: number, busy: boolean) {
    updateBusyList(setRemovingItemIds, itemId, busy);
  }

  function commitCart(nextCart: Cart | null) {
    if (!nextCart) return;
    const normalized = normalizeCart(nextCart);
    setCart(normalized);
    announceCartUpdate(normalized);
  }

  async function loadCart(showError = false) {
    const requestId = ++requestIdRef.current;
    try {
      const response = await fetch(`/api/cart?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await readJson<Cart | { error?: string }>(response);
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      if (response.status === 401) {
        window.location.href = "/login?next=/cart";
        return null;
      }
      if (!response.ok) {
        if (showError) setError(errorMessage(data, "Количката не можа да се зареди."));
        commitCart({ items: [], totalItems: 0, subtotal: 0 });
        return null;
      }
      const serverCart = readServerCart(data) ?? { items: [], totalItems: 0, subtotal: 0 };
      setError("");
      commitCart(serverCart);
      return serverCart;
    } catch {
      if (mountedRef.current && showError) setError("Количката не можа да се зареди.");
      return null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadCart(true);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mutateCart(itemId: number, nextQuantity: number) {
    setError("");
    const safeQuantity = Math.max(0, Math.floor(Number(nextQuantity) || 0));
    const isRemoving = safeQuantity <= 0;
    if (isRemoving) setRemovingBusy(itemId, true);
    else setQuantityBusy(itemId, true);

    try {
      const response = await fetch(safeQuantity <= 0 ? `/api/cart?itemId=${itemId}` : "/api/cart", {
        method: safeQuantity <= 0 ? "DELETE" : "PATCH",
        headers: safeQuantity <= 0 ? { "Cache-Control": "no-cache" } : { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        credentials: "include",
        cache: "no-store",
        body: safeQuantity <= 0 ? undefined : JSON.stringify({ itemId, quantity: safeQuantity }),
      });
      const data = await readJson<Cart | { error?: string }>(response);
      if (!mountedRef.current) return;

      if (!response.ok) {
        setError(errorMessage(data, "Количката не можа да бъде обновена."));
        await loadCart(false);
        return;
      }

      // Само сървърът е източникът на истината. Няма optimistic snapshot,
      // няма debounce и няма второ състояние за обобщението.
      const serverCart = readServerCart(data);
      if (serverCart) commitCart(serverCart);
      await loadCart(false);
    } catch {
      if (mountedRef.current) {
        setError("Количката не можа да бъде обновена.");
        await loadCart(false);
      }
    } finally {
      if (mountedRef.current) {
        if (isRemoving) setRemovingBusy(itemId, false);
        else setQuantityBusy(itemId, false);
      }
    }
  }

  function update(itemId: number, direction: 1 | -1) {
    const currentItem = cart?.items.find((entry) => entry.id === itemId);
    if (!currentItem || busyQuantityItemIds.includes(itemId) || removingItemIds.includes(itemId)) return;
    void mutateCart(itemId, currentItem.quantity + direction);
  }

  function remove(itemId: number) {
    if (busyQuantityItemIds.includes(itemId) || removingItemIds.includes(itemId)) return;
    void mutateCart(itemId, 0);
  }

  if (!cart && error) return <div className={styles.notice}>{error}</div>;
  if (!cart) return <div className={styles.notice}>Зареждане...</div>;

  const displayCart = normalizeCart(cart);
  const hasUnavailableItems = displayCart.items.some((item) => item.availableStock <= 0);

  if (!displayCart.items.length) {
    return (
      <div className={styles.empty}>
        <h2>Количката е празна</h2>
        <Link href="/women">Към продуктите</Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.items}>
        {error ? <div className={styles.notice}>{error}</div> : null}
        {displayCart.items.map((item) => {
          const isQuantityBusy = busyQuantityItemIds.includes(item.id);
          const isRemoving = removingItemIds.includes(item.id);
          const isRowBusy = isQuantityBusy || isRemoving;
          return (
            <article key={`${item.id}-${item.quantity}-${item.lineTotal}`} className={styles.item} aria-busy={isRowBusy}>
              <Link className={styles.imageLink} href={`/products/${item.slug}`} aria-label={`Отвори ${item.name}`}>
                <Image src={item.imageUrl} alt={item.name} width={110} height={135} sizes="(max-width: 600px) 80px, 110px" />
              </Link>
              <div className={styles.details}>
                <Link className={styles.productName} href={`/products/${item.slug}`}>{item.name}</Link>
                <div className={styles.variantDetails} aria-label="Детайли за избрания продукт">
                  <p className={styles.sizeBadge}><strong>Размер:</strong> <span>{item.size || "Не е посочен"}</span></p>
                  {item.color ? <p><strong>Цвят:</strong> <span>{item.color}</span></p> : null}
                  {item.material ? <p><strong>Материал:</strong> <span>{item.material}</span></p> : null}
                </div>
                {item.availableStock <= 0 ? (
                  <div className={styles.unavailable} role="alert">
                    Избраният размер вече не е наличен. Моля, премахнете продукта и изберете друг размер.
                  </div>
                ) : null}
                {item.description ? <p className={styles.description}>{item.description}</p> : null}
                <p className={styles.unitPrice}><strong>Единична цена:</strong> {money(item.price)}</p>
                <div className={styles.quantity} aria-label={`Количество за ${item.name}, размер ${item.size}`}>
                  <button type="button" disabled={isRowBusy} onClick={() => update(item.id, -1)}>−</button>
                  <strong>{item.quantity}</strong>
                  <button type="button" disabled={isRowBusy} onClick={() => update(item.id, 1)}>+</button>
                </div>
              </div>
              <div className={styles.end}>
                <strong>{money(item.lineTotal)}</strong>
                <button type="button" disabled={isRowBusy} onClick={() => remove(item.id)}>{isRemoving ? "Премахване..." : "Премахни"}</button>
              </div>
            </article>
          );
        })}
      </section>
      <aside key={`${displayCart.totalItems}-${displayCart.subtotal}`} className={styles.summary}>
        <span>ОБОБЩЕНИЕ</span>
        <h2>Общо</h2>
        <p>Продукти: {displayCart.totalItems}</p>
        <strong>{money(displayCart.subtotal)}</strong>
        {hasUnavailableItems ? (
          <div className={styles.checkoutBlocked} role="alert">
            Проверете отбелязаните продукти, преди да продължите.
          </div>
        ) : (
          <Link className={styles.checkoutButton} href="/checkout">
            Продължи към поръчка
          </Link>
        )}
      </aside>
    </div>
  );
}
