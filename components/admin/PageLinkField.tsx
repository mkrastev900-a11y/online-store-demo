"use client";

import { useMemo } from "react";

export type PageLinkOption = { label: string; value: string; group?: string };

export const STORE_PAGE_LINK_OPTIONS: PageLinkOption[] = [
  { label: "Начална страница", value: "/", group: "Магазин" },
  { label: "Дамско", value: "/women", group: "Магазин" },
  { label: "Мъжко", value: "/men", group: "Магазин" },
  { label: "Детско", value: "/kids", group: "Магазин" },
  { label: "Нови", value: "/new", group: "Магазин" },
  { label: "Промоции", value: "/sale", group: "Магазин" },
  { label: "Брандове", value: "/brands", group: "Магазин" },
  { label: "Контакти", value: "/contact", group: "Информация" },
  { label: "За нас", value: "/about", group: "Информация" },
  { label: "Търсене", value: "/search", group: "Профил и поръчки" },
  { label: "Любими", value: "/favorites", group: "Профил и поръчки" },
  { label: "Количка", value: "/cart", group: "Профил и поръчки" },
  { label: "Поръчка / Checkout", value: "/checkout", group: "Профил и поръчки" },
  { label: "Профил", value: "/account", group: "Профил и поръчки" },
  { label: "Хронология", value: "/history", group: "Профил и поръчки" },
  { label: "Вход", value: "/login", group: "Профил и поръчки" },
  { label: "Регистрация", value: "/register", group: "Профил и поръчки" },
  { label: "Общи условия", value: "/terms", group: "Правни страници" },
  { label: "Поверителност", value: "/privacy", group: "Правни страници" },
];

const CUSTOM_VALUE = "__custom_page_link__";

export default function PageLinkField({
  label = "Страница на бутона",
  value,
  onChange,
  options = STORE_PAGE_LINK_OPTIONS,
  help = "Избери страница от сайта или използвай персонализиран адрес.",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: PageLinkOption[];
  help?: string;
}) {
  const normalizedOptions = useMemo(() => {
    const unique = new Map<string, PageLinkOption>();
    for (const option of options) {
      if (option.value && !unique.has(option.value)) unique.set(option.value, option);
    }
    return [...unique.values()];
  }, [options]);

  const isKnown = normalizedOptions.some((option) => option.value === value);
  const selectedValue = isKnown ? value : CUSTOM_VALUE;
  const groups = [...new Set(normalizedOptions.map((option) => option.group || "Страници"))];

  return (
    <label style={{ display: "grid", gap: 8, fontWeight: 700 }}>
      <span>{label}</span>
      <select
        value={selectedValue}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === CUSTOM_VALUE ? "" : next);
        }}
        style={{ width: "100%", minHeight: 50, border: "1px solid #dfd4d7", borderRadius: 14, padding: "0 14px", background: "#fff", color: "#24161b", font: "inherit" }}
      >
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {normalizedOptions.filter((option) => (option.group || "Страници") === group).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_VALUE}>Персонализиран адрес…</option>
      </select>
      {selectedValue === CUSTOM_VALUE ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Например /products/име или https://example.com"
          style={{ width: "100%", minHeight: 50, boxSizing: "border-box", border: "1px solid #dfd4d7", borderRadius: 14, padding: "0 14px", background: "#fff", color: "#24161b", font: "inherit" }}
        />
      ) : null}
      {help ? <small style={{ fontWeight: 400, lineHeight: 1.45, opacity: 0.72 }}>{help}</small> : null}
    </label>
  );
}
