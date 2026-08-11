export type CartSummary = {
  totalItems: number;
  subtotal: number;
};

export const CART_UPDATED_EVENT = "zlatevi-cart-updated";
export const EMPTY_CART_SUMMARY: CartSummary = { totalItems: 0, subtotal: 0 };

export function toCartSummary(value: unknown): CartSummary {
  const cart = value && typeof value === "object"
    ? value as { totalItems?: unknown; subtotal?: unknown }
    : {};
  const totalItems = Number(cart.totalItems);
  const subtotal = Number(cart.subtotal);

  return {
    totalItems: Number.isFinite(totalItems) ? Math.max(0, Math.floor(totalItems)) : 0,
    subtotal: Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0,
  };
}

export function announceCartUpdate(cart: unknown) {
  if (typeof window === "undefined") return;
  const detail = toCartSummary(cart);
  const dispatch = () => {
    window.dispatchEvent(new CustomEvent<CartSummary>(CART_UPDATED_EVENT, { detail }));
  };

  // Събитието се изпраща асинхронно, за да не може компонент като CartClient
  // да обнови Header по време на собствен render цикъл.
  if (typeof queueMicrotask === "function") queueMicrotask(dispatch);
  else window.setTimeout(dispatch, 0);
}
