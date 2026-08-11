export const STORE_CURRENCY = "EUR" as const;
export const STORE_LOCALE = "bg-BG";

export function formatPrice(value: number) {
  return new Intl.NumberFormat(STORE_LOCALE, {
    style: "currency",
    currency: STORE_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
