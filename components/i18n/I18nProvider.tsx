"use client";

import { createContext, useContext, useMemo } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

type I18nContextValue = {
  locale: AppLocale;
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(text: string, values?: Record<string, string | number>) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(() => ({
    locale: "bg",
    t: (key, fallback, values) => interpolate(MESSAGES.bg[key] ?? fallback ?? key, values),
    formatNumber: (number, options) => new Intl.NumberFormat("bg-BG", options).format(number),
    formatDate: (date, options) => new Intl.DateTimeFormat("bg-BG", options).format(new Date(date)),
    formatCurrency: (number, currency = "EUR") => new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(number),
  }), []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
