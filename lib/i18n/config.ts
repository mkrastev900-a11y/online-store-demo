export const SUPPORTED_LOCALES = ["bg"] as const;
export type AppLocale = "bg";
export const DEFAULT_LOCALE: AppLocale = "bg";

export const LOCALE_META = {
  bg: { nativeName: "Български", englishName: "Bulgarian", flag: "🇧🇬", intl: "bg-BG" },
} as const;

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "bg";
}
