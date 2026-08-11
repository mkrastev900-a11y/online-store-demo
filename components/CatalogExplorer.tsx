/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useState } from "react";
import DbProductCard from "@/components/DbProductCard";
import type { Product } from "@/lib/catalog";
import styles from "./CatalogPage.module.css";

type Props = { products: Product[] };
type ListFilter = "category" | "type" | "brand" | "material" | "color" | "size";
type Filters = {
  category: string[];
  type: string[];
  brand: string[];
  material: string[];
  color: string[];
  size: string[];
  min: string;
  max: string;
  inStock: boolean;
  onSale: boolean;
  isNew: boolean;
  sort: string;
};

type ActiveChip = { id: string; label: string; remove: () => void };
type FilterOption = { value: string; label: string; count: number };

const PRODUCTS_PER_PAGE = 12;

const emptyFilters: Filters = {
  category: [], type: [], brand: [], material: [], color: [], size: [], min: "", max: "",
  inStock: false, onSale: false, isNew: false, sort: "recommended",
};

const normalize = (value: string | null) => value?.trim() ?? "";
const canonical = (value: string | null | undefined) => normalize(value ?? null).toLocaleLowerCase("bg-BG");
const listFromParam = (value: string | null) => value ? value.split(",").map(decodeURIComponent).filter(Boolean) : [];

function readFilters(): Filters {
  if (typeof window === "undefined") return emptyFilters;
  const params = new URLSearchParams(window.location.search);
  return {
    category: listFromParam(params.get("category")),
    type: listFromParam(params.get("type")),
    brand: listFromParam(params.get("brand")),
    material: listFromParam(params.get("material")),
    color: listFromParam(params.get("color")),
    size: listFromParam(params.get("size")),
    min: normalize(params.get("min")),
    max: normalize(params.get("max")),
    inStock: params.get("stock") === "1",
    onSale: params.get("sale") === "1",
    isNew: params.get("new") === "1",
    sort: params.get("sort") || "recommended",
  };
}

function totalStock(product: Product) {
  const activeVariants = product.variants.filter((variant) => variant.isActive !== false);
  if (activeVariants.length) return activeVariants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
  return Math.max(0, product.stock);
}

function productTypeLabel(product: Product) {
  const storedKind = product.productKind?.trim();
  if (storedKind) return storedKind;
  const exactType = product.garmentType?.trim();
  if (exactType) return exactType;
  if (product.productType === "SHOES") return "Обувки";
  if (product.productType === "ACCESSORY") return "Аксесоари";
  return "Дрехи";
}

function sizeRank(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  const alpha = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];
  const alphaIndex = alpha.indexOf(normalized);
  if (alphaIndex >= 0) return alphaIndex;
  const numeric = Number(normalized.replace(",", "."));
  if (Number.isFinite(numeric)) return 100 + numeric;
  const euMatch = normalized.match(/^(?:EU)?(\d+(?:\.\d+)?)$/);
  if (euMatch) return 100 + Number(euMatch[1]);
  return 10000;
}

function sortSizes(a: string, b: string) {
  const rankDifference = sizeRank(a) - sizeRank(b);
  return rankDifference || a.localeCompare(b, "bg", { numeric: true, sensitivity: "base" });
}

function matchesList(selected: string[], value: string | null | undefined) {
  if (!selected.length) return true;
  const key = canonical(value);
  return Boolean(key) && selected.some((item) => canonical(item) === key);
}

function matchesProduct(product: Product, filters: Filters, ignored?: ListFilter) {
  const min = filters.min === "" ? null : Number(filters.min);
  const max = filters.max === "" ? null : Number(filters.max);

  if (ignored !== "category" && filters.category.length && !filters.category.includes(product.categorySlug)) return false;
  if (ignored !== "type" && !matchesList(filters.type, productTypeLabel(product))) return false;
  if (ignored !== "brand" && !matchesList(filters.brand, product.brand)) return false;
  if (ignored !== "material" && !matchesList(filters.material, product.material)) return false;
  if (ignored !== "color" && !matchesList(filters.color, product.color)) return false;
  if (ignored !== "size" && filters.size.length && !product.variants.some((variant) => variant.isActive !== false && variant.stock > 0 && matchesList(filters.size, variant.size))) return false;
  if (min !== null && Number.isFinite(min) && product.price < min) return false;
  if (max !== null && Number.isFinite(max) && product.price > max) return false;
  if (filters.inStock && totalStock(product) <= 0) return false;
  if (filters.onSale && !(product.compareAtPrice !== null && product.compareAtPrice > product.price)) return false;
  if (filters.isNew && !product.isNew) return false;
  return true;
}

function buildOptions(
  products: Product[],
  filters: Filters,
  key: ListFilter,
  valuesForProduct: (product: Product) => Array<{ value: string; label: string }>,
  sort?: (a: FilterOption, b: FilterOption) => number,
): FilterOption[] {
  const counts = new Map<string, FilterOption>();
  products.filter((product) => matchesProduct(product, filters, key)).forEach((product) => {
    const seen = new Set<string>();
    valuesForProduct(product).forEach(({ value, label }) => {
      const normalizedValue = normalize(value);
      const normalizedLabel = normalize(label);
      const identity = canonical(normalizedValue);
      if (!identity || seen.has(identity)) return;
      seen.add(identity);
      const current = counts.get(identity);
      if (current) current.count += 1;
      else counts.set(identity, { value: normalizedValue, label: normalizedLabel || normalizedValue, count: 1 });
    });
  });
  const options = [...counts.values()];
  options.sort(sort ?? ((a, b) => a.label.localeCompare(b.label, "bg", { numeric: true, sensitivity: "base" })));
  return options;
}

export default function CatalogExplorer({ products }: Props) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilters(readFilters());
    setReady(true);
    const syncFromHistory = () => setFilters(readFilters());
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (filters.category.length) params.set("category", filters.category.join(","));
    if (filters.type.length) params.set("type", filters.type.join(","));
    if (filters.brand.length) params.set("brand", filters.brand.join(","));
    if (filters.material.length) params.set("material", filters.material.join(","));
    if (filters.color.length) params.set("color", filters.color.join(","));
    if (filters.size.length) params.set("size", filters.size.join(","));
    if (filters.min) params.set("min", filters.min);
    if (filters.max) params.set("max", filters.max);
    if (filters.inStock) params.set("stock", "1");
    if (filters.onSale) params.set("sale", "1");
    if (filters.isNew) params.set("new", "1");
    if (filters.sort !== "recommended") params.set("sort", filters.sort);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters, ready]);

  useEffect(() => {
    if (!ready) return;
    setPage(1);
  }, [filters, ready]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const options = useMemo(() => ({
    categories: buildOptions(products, filters, "category", (product) => [{ value: product.categorySlug, label: product.categoryName }]),
    types: buildOptions(products, filters, "type", (product) => [{ value: productTypeLabel(product), label: productTypeLabel(product) }]),
    brands: buildOptions(products, filters, "brand", (product) => product.brand ? [{ value: product.brand, label: product.brand }] : []),
    materials: buildOptions(products, filters, "material", (product) => product.material ? [{ value: product.material, label: product.material }] : []),
    colors: buildOptions(products, filters, "color", (product) => product.color ? [{ value: product.color, label: product.color }] : []),
    sizes: buildOptions(
      products,
      filters,
      "size",
      (product) => product.variants.filter((variant) => variant.isActive !== false && variant.stock > 0).map((variant) => ({ value: variant.size, label: variant.size })),
      (a, b) => sortSizes(a.label, b.label),
    ),
  }), [products, filters]);

  const result = useMemo(() => {
    const filtered = products.filter((product) => matchesProduct(product, filters));
    return [...filtered].sort((a, b) => {
      switch (filters.sort) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "name-asc": return a.name.localeCompare(b.name, "bg");
        case "name-desc": return b.name.localeCompare(a.name, "bg");
        default:
          return Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [products, filters]);

  const pageCount = Math.max(1, Math.ceil(result.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const paginatedResult = useMemo(
    () => result.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE),
    [result, currentPage],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const activeCount = filters.category.length + filters.type.length + filters.brand.length + filters.material.length + filters.color.length + filters.size.length +
    Number(Boolean(filters.min || filters.max)) + Number(filters.inStock) + Number(filters.onSale) + Number(filters.isNew);

  const toggleList = (key: ListFilter, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const removeListValue = (key: ListFilter, value: string) => {
    setFilters((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }));
  };

  const activeChips = useMemo<ActiveChip[]>(() => {
    const optionLabel = (key: ListFilter, value: string) => {
      const collection = key === "category" ? options.categories : key === "type" ? options.types : key === "brand" ? options.brands : key === "material" ? options.materials : key === "color" ? options.colors : options.sizes;
      return collection.find((option) => option.value === value)?.label ?? value;
    };
    const chips: ActiveChip[] = [];
    const addList = (key: ListFilter, prefix: string) => {
      filters[key].forEach((value) => chips.push({ id: `${key}-${value}`, label: `${prefix}: ${optionLabel(key, value)}`, remove: () => removeListValue(key, value) }));
    };
    addList("category", "Категория");
    addList("type", "Тип");
    addList("brand", "Марка");
    addList("material", "Материал");
    addList("size", "Размер");
    addList("color", "Цвят");
    if (filters.min || filters.max) chips.push({ id: "price", label: `Цена: ${filters.min || "0"}–${filters.max || "∞"} €`, remove: () => setFilters((f) => ({ ...f, min: "", max: "" })) });
    if (filters.inStock) chips.push({ id: "stock", label: "Само налични", remove: () => setFilters((f) => ({ ...f, inStock: false })) });
    if (filters.onSale) chips.push({ id: "sale", label: "Само намалени", remove: () => setFilters((f) => ({ ...f, onSale: false })) });
    if (filters.isNew) chips.push({ id: "new", label: "Само нови", remove: () => setFilters((f) => ({ ...f, isNew: false })) });
    return chips;
  }, [filters, options]);

  const filterPanel = (
    <div className={styles.filterPanel}>
      <div className={styles.filterPanelHead}>
        <div><span>Филтри</span>{activeCount > 0 && <b>{activeCount}</b>}</div>
        <button type="button" onClick={() => setFilters(emptyFilters)} disabled={!activeCount}>Изчисти</button>
      </div>

      <FilterGroup title="Категория" values={options.categories} selected={filters.category} onToggle={(v) => toggleList("category", v)} />
      <FilterGroup title="Тип артикул" values={options.types} selected={filters.type} onToggle={(v) => toggleList("type", v)} />
      {options.brands.length > 0 && <FilterGroup title="Марка" values={options.brands} selected={filters.brand} onToggle={(v) => toggleList("brand", v)} />}
      {options.materials.length > 0 && <FilterGroup title="Материал" values={options.materials} selected={filters.material} onToggle={(v) => toggleList("material", v)} />}
      {options.sizes.length > 0 && <FilterGroup title="Размер" values={options.sizes} selected={filters.size} onToggle={(v) => toggleList("size", v)} compact />}
      {options.colors.length > 0 && <FilterGroup title="Цвят" values={options.colors} selected={filters.color} onToggle={(v) => toggleList("color", v)} />}

      <details className={styles.filterGroup} open>
        <summary>Цена</summary>
        <div className={styles.priceRow}>
          <label><span>От</span><input inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={filters.min} onChange={(e) => setFilters((f) => ({ ...f, min: e.target.value }))} /></label>
          <label><span>До</span><input inputMode="decimal" type="number" min="0" step="0.01" placeholder="∞" value={filters.max} onChange={(e) => setFilters((f) => ({ ...f, max: e.target.value }))} /></label>
        </div>
      </details>

      <details className={styles.filterGroup} open>
        <summary>Предложения</summary>
        <div className={styles.checkList}>
          <Toggle label="Само налични" checked={filters.inStock} onChange={(checked) => setFilters((f) => ({ ...f, inStock: checked }))} />
          <Toggle label="Само намалени" checked={filters.onSale} onChange={(checked) => setFilters((f) => ({ ...f, onSale: checked }))} />
          <Toggle label="Само нови" checked={filters.isNew} onChange={(checked) => setFilters((f) => ({ ...f, isNew: checked }))} />
        </div>
      </details>
    </div>
  );

  return (
    <section className={styles.catalog} aria-busy={!ready}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.mobileFilterButton} type="button" onClick={() => setMobileOpen(true)}>Филтри {activeCount > 0 && <b>{activeCount}</b>}</button>
          <strong>{result.length} {result.length === 1 ? "продукт" : "продукта"}</strong>
        </div>
        <label className={styles.sortLabel}>Сортиране
          <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
            <option value="recommended">Препоръчани</option>
            <option value="newest">Най-нови</option>
            <option value="price-asc">Цена: ниска към висока</option>
            <option value="price-desc">Цена: висока към ниска</option>
            <option value="name-asc">Име: А–Я</option>
            <option value="name-desc">Име: Я–А</option>
          </select>
        </label>
      </div>

      {activeChips.length > 0 && <div className={styles.chipBar} aria-label="Активни филтри">
        <div>{activeChips.map((chip) => <button type="button" key={chip.id} onClick={chip.remove}>{chip.label}<span aria-hidden="true">×</span></button>)}</div>
        <button type="button" className={styles.clearAll} onClick={() => setFilters(emptyFilters)}>Премахни всички</button>
      </div>}

      <div className={styles.catalogLayout}>
        <aside className={styles.desktopFilters}>{filterPanel}</aside>
        <div className={styles.results}>
          {result.length > 0 ? <><div className={styles.grid}>{paginatedResult.map((product) => <DbProductCard key={product.id} product={product} />)}</div><CatalogPagination page={currentPage} pages={pageCount} total={result.length} onChange={setPage} /></> : <div className={styles.empty}><strong>Няма намерени продукти</strong><p>Промени или изчисти избраните филтри.</p><button type="button" onClick={() => setFilters(emptyFilters)}>Изчисти филтрите</button></div>}
        </div>
      </div>

      {mobileOpen && <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Филтри за продукти"><button className={styles.overlayClose} type="button" aria-label="Затвори филтрите" onClick={() => setMobileOpen(false)} /><aside className={styles.mobileDrawer}><div className={styles.drawerHead}><strong>Филтри</strong><button type="button" aria-label="Затвори" onClick={() => setMobileOpen(false)}>×</button></div>{filterPanel}<button type="button" className={styles.showResults} onClick={() => setMobileOpen(false)}>Покажи {result.length} продукта</button></aside></div>}
    </section>
  );
}

function CatalogPagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (total <= PRODUCTS_PER_PAGE) return null;
  const first = (page - 1) * PRODUCTS_PER_PAGE + 1;
  const last = Math.min(page * PRODUCTS_PER_PAGE, total);
  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter((value) => value === 1 || value === pages || Math.abs(value - page) <= 1);

  const go = (nextPage: number) => {
    onChange(Math.max(1, Math.min(pages, nextPage)));
    requestAnimationFrame(() => {
      document.querySelector(`.${styles.results}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return <nav className={styles.pagination} aria-label="Страници с продукти">
    <div className={styles.paginationInfo}>Показани {first}–{last} от {total}</div>
    <div className={styles.paginationControls}>
      <button type="button" className={styles.pageButton} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Предишна страница">‹</button>
      <div className={styles.pageGroup}>
        {visible.map((value, index) => {
          const previous = visible[index - 1];
          return <span key={value} className={styles.pageSlot}>
            {previous && value - previous > 1 ? <span className={styles.pageDots}>…</span> : null}
            <button type="button" className={`${styles.pageButton} ${value === page ? styles.pageButtonActive : ""}`} onClick={() => go(value)} aria-current={value === page ? "page" : undefined}>{value}</button>
          </span>;
        })}
      </div>
      <button type="button" className={styles.pageButton} onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Следваща страница">›</button>
    </div>
  </nav>;
}

function FilterGroup({ title, values, selected, onToggle, compact = false }: { title: string; values: FilterOption[]; selected: string[]; onToggle: (value: string) => void; compact?: boolean }) {
  if (!values.length) return null;
  return <details className={styles.filterGroup} open><summary>{title}</summary><div className={compact ? styles.sizeList : styles.checkList}>{values.map((option) => compact ? <button type="button" key={option.value} className={selected.includes(option.value) ? styles.sizeActive : ""} aria-pressed={selected.includes(option.value)} onClick={() => onToggle(option.value)} title={`${option.count} продукта`}>{option.label}<small>{option.count}</small></button> : <Toggle key={option.value} label={option.label} count={option.count} checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />)}</div></details>;
}

function Toggle({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className={styles.checkItem}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className={styles.customCheck}>✓</span><em>{label}</em>{typeof count === "number" && <small>{count}</small>}</label>;
}
