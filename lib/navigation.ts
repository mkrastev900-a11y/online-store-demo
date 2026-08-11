export const PUBLIC_NAVIGATION = [
  { href: "/", label: "Начало" },
  { href: "/women", label: "Дамско" },
  { href: "/men", label: "Мъжко" },
  { href: "/kids", label: "Детско" },
  { href: "/new", label: "Нови" },
  { href: "/sale", label: "Промоции" },
  { href: "/contact", label: "Контакти" },
  { href: "/about", label: "За нас" },
] as const;

export function isStorefrontPath(pathname: string) {
  return !pathname.startsWith("/admin") && !pathname.startsWith("/print/") && !pathname.startsWith("/visual-editor");
}
