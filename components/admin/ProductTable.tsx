/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProductTable.module.css";

type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  imageUrl?: string | null;
  images?: Array<{ url: string; alt?: string | null; sortOrder?: number }>;
  audience: string;
  productType: string;
  isActive: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  brand?: string | null;
  color?: string | null;
  category: { name: string; slug?: string };
  variants: Array<{ id: number; size: string; stock: number }>;
};

const labels: Record<string, string> = {
  WOMEN: "Дамско", MEN: "Мъжко", KIDS: "Детско",
  CLOTHING: "Дреха", SHOES: "Обувки", ACCESSORY: "Аксесоар",
};

function categoryMatchesAudience(category: Product["category"], audience: string) {
  if (audience === "ALL") return true;
  const identity = `${category.slug ?? ""} ${category.name}`.toLocaleLowerCase("bg");
  const explicitlyKids = /(^|[\s_-])(kids?|children|child|детск)/.test(identity);
  const explicitlyWomen = /(^|[\s_-])(women?|woman|дамск|женск)/.test(identity);
  const explicitlyMen = /(^|[\s_-])(men|man|мъжк)/.test(identity);
  if (explicitlyKids) return audience === "KIDS";
  if (explicitlyWomen) return audience === "WOMEN";
  if (explicitlyMen) return audience === "MEN";
  return true;
}

export default function ProductTable({ products, canEdit, canDelete }: { products: Product[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [brand, setBrand] = useState("ALL");
  const [size, setSize] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const categories = useMemo(() => {
    return [...new Set(products
      .filter((product) => audience === "ALL" || product.audience === audience)
      .filter((product) => categoryMatchesAudience(product.category, audience))
      .filter((product) => type === "ALL" || product.productType === type)
      .map((product) => product.category.name))].sort((a, b) => a.localeCompare(b, "bg"));
  }, [products, audience, type]);
  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean) as string[])].sort(), [products]);
  const sizes = useMemo(() => [...new Set(products.flatMap(p => p.variants.map(v => v.size)))].sort(), [products]);

  useEffect(() => {
    if (category !== "ALL" && !categories.includes(category)) setCategory("ALL");
  }, [categories, category]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);
    const filtered = products.filter(product => {
      if (q && !`${product.name} ${product.brand ?? ""} ${product.category.name} ${product.slug}`.toLowerCase().includes(q)) return false;
      if (audience !== "ALL" && product.audience !== audience) return false;
      if (type !== "ALL" && product.productType !== type) return false;
      if (category !== "ALL" && product.category.name !== category) return false;
      if (brand !== "ALL" && product.brand !== brand) return false;
      if (size !== "ALL" && !product.variants.some(v => v.size === size)) return false;
      if (status === "ACTIVE" && !product.isActive) return false;
      if (status === "INACTIVE" && product.isActive) return false;
      if (status === "NEW" && !product.isNew) return false;
      if (status === "FEATURED" && !product.isFeatured) return false;
      if (status === "SALE" && !(product.compareAtPrice && product.compareAtPrice > product.price)) return false;
      if (stock === "IN" && product.stock <= 0) return false;
      if (stock === "OUT" && product.stock > 0) return false;
      if (stock === "LOW" && !(product.stock > 0 && product.stock <= 5)) return false;
      if (min !== null && Number.isFinite(min) && product.price < min) return false;
      if (max !== null && Number.isFinite(max) && product.price > max) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "name-asc") return a.name.localeCompare(b.name, "bg");
      if (sort === "name-desc") return b.name.localeCompare(a.name, "bg");
      if (sort === "stock-asc") return a.stock - b.stock;
      if (sort === "stock-desc") return b.stock - a.stock;
      return b.id - a.id;
    });
  }, [products, query, audience, type, category, brand, size, status, stock, sort, minPrice, maxPrice]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paginatedProducts = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, audience, type, category, brand, size, status, stock, sort, minPrice, maxPrice]);

  const activeCount = [query, audience !== "ALL", type !== "ALL", category !== "ALL", brand !== "ALL", size !== "ALL", status !== "ALL", stock !== "ALL", minPrice, maxPrice].filter(Boolean).length;
  function clearFilters() { setQuery(""); setAudience("ALL"); setType("ALL"); setCategory("ALL"); setBrand("ALL"); setSize("ALL"); setStatus("ALL"); setStock("ALL"); setMinPrice(""); setMaxPrice(""); setSort("newest"); setPage(1); }

  async function remove(id: number, name: string) {
    if (deletingId !== null) return;
    if (!confirm(`Да изтрия ли продукта „${name}“?`)) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const text = await response.text();
      let payload: { message?: string; error?: string } = {};
      if (text.trim()) {
        try {
          payload = JSON.parse(text) as { message?: string; error?: string };
        } catch {
          payload = { error: text };
        }
      }

      if (!response.ok) {
        alert(payload.error || "Продуктът не беше изтрит.");
        return;
      }

      alert(payload.message || "Продуктът е изтрит.");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Продуктът не беше изтрит.");
    } finally {
      setDeletingId(null);
    }
  }

  const renderFilters = () => <div className={styles.filterGrid}>
    <label className={styles.search}><span>Търсене</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Име, марка, категория..." /></label>
    <label><span>Секция</span><select value={audience} onChange={e => { setAudience(e.target.value); setCategory("ALL"); }}><option value="ALL">Всички</option><option value="WOMEN">Дамско</option><option value="MEN">Мъжко</option><option value="KIDS">Детско</option></select></label>
    <label><span>Тип</span><select value={type} onChange={e => { setType(e.target.value); setCategory("ALL"); }}><option value="ALL">Всички</option><option value="CLOTHING">Дрехи</option><option value="SHOES">Обувки</option><option value="ACCESSORY">Аксесоари</option></select></label>
    <label><span>Категория</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="ALL">Всички</option>{categories.map(v => <option key={v}>{v}</option>)}</select></label>
    <label><span>Марка</span><select value={brand} onChange={e => setBrand(e.target.value)}><option value="ALL">Всички</option>{brands.map(v => <option key={v}>{v}</option>)}</select></label>
    <label><span>Размер</span><select value={size} onChange={e => setSize(e.target.value)}><option value="ALL">Всички</option>{sizes.map(v => <option key={v}>{v}</option>)}</select></label>
    <label><span>Статус</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Всички</option><option value="ACTIVE">Активни</option><option value="INACTIVE">Скрити</option><option value="NEW">Нови</option><option value="FEATURED">Препоръчани</option><option value="SALE">Намалени</option></select></label>
    <label><span>Наличност</span><select value={stock} onChange={e => setStock(e.target.value)}><option value="ALL">Всички</option><option value="IN">В наличност</option><option value="LOW">Ниска (1–5)</option><option value="OUT">Изчерпани</option></select></label>
    <label><span>Мин. цена</span><input type="number" min="0" step="0.01" value={minPrice} onChange={e => setMinPrice(e.target.value)} /></label>
    <label><span>Макс. цена</span><input type="number" min="0" step="0.01" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
    <label><span>Сортиране</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Най-нови</option><option value="price-asc">Цена ↑</option><option value="price-desc">Цена ↓</option><option value="name-asc">Име А–Я</option><option value="name-desc">Име Я–А</option><option value="stock-asc">Наличност ↑</option><option value="stock-desc">Наличност ↓</option></select></label>
  </div>;

  return <div className={styles.wrapper}>
    <div className={styles.toolbar}>
      <div><strong>{visible.length}</strong><span> от {products.length} продукта</span></div>
      <div className={styles.toolbarActions}><button className={styles.mobileFilter} onClick={() => setMobileOpen(true)}>Филтри {activeCount ? `(${activeCount})` : ""}</button>{activeCount > 0 && <button className={styles.clear} onClick={clearFilters}>Изчисти</button>}</div>
    </div>
    <div className={styles.desktopFilters}>{renderFilters()}</div>
    {mobileOpen && <div className={styles.overlay} onMouseDown={() => setMobileOpen(false)}><div className={styles.drawer} onMouseDown={e => e.stopPropagation()}><div className={styles.drawerHead}><h2>Филтри</h2><button onClick={() => setMobileOpen(false)}>×</button></div>{renderFilters()}<div className={styles.drawerActions}><button onClick={clearFilters}>Изчисти</button><button onClick={() => setMobileOpen(false)}>Покажи {visible.length}</button></div></div></div>}

    {visible.length === 0 ? <div className={styles.empty}>Няма продукти, отговарящи на избраните филтри.</div> : paginatedProducts.map(product => {
      const primaryImage = product.images?.[0]?.url || product.imageUrl || "";
      return <article key={product.id} className={styles.row}>
      <div className={styles.productIdentity}>
        <Link className={styles.imageLink} href={`/products/${product.slug}`} aria-label={`Преглед на ${product.name}`}>
          {primaryImage ? (
            <Image
              className={styles.productImage}
              src={primaryImage}
              alt={product.images?.[0]?.alt || product.name}
              width={92}
              height={112}
              sizes="92px"
            />
          ) : (
            <span className={styles.imagePlaceholder} aria-hidden="true">Без снимка</span>
          )}
        </Link>
        <div className={styles.productSummary}>
          <strong>{product.name}</strong>
          <span>{product.category.name}{product.brand ? ` · ${product.brand}` : ""}</span>
          <div className={styles.badges}>{!product.isActive && <em>Скрит</em>}{product.isNew && <em>Нов</em>}{product.isFeatured && <em>Препоръчан</em>}{product.compareAtPrice && product.compareAtPrice > product.price && <em>Намален</em>}</div>
        </div>
      </div>
      <div><span>Секция</span><strong>{labels[product.audience]}</strong></div>
      <div><span>Тип</span><strong>{labels[product.productType]}</strong></div>
      <div><span>Цена</span><strong>{product.price.toFixed(2)} €</strong></div>
      <div><span>Наличност</span><strong className={product.stock === 0 ? styles.out : product.stock <= 5 ? styles.low : ""}>{product.stock}</strong></div>
      <div className={styles.actions}><Link href={`/products/${product.slug}`}>Преглед</Link>{canEdit ? <Link className={styles.edit} href={`/admin/products/${product.id}/edit`}>Редактирай</Link> : null}{canDelete ? <button disabled={deletingId === product.id} onClick={() => remove(product.id, product.name)}>{deletingId === product.id ? "Изтриване…" : "Изтрий"}</button> : null}</div>
    </article>;
    })}

    <Pagination
      page={currentPage}
      pages={pages}
      total={visible.length}
      pageSize={pageSize}
      onChange={setPage}
    />
  </div>;
}

function Pagination({
  page,
  pages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter((value) => {
    if (pages <= 7) return true;
    return value === 1 || value === pages || Math.abs(value - page) <= 1;
  });

  return (
    <nav className={styles.pagination} aria-label="Страници с продукти">
      <div className={styles.paginationInfo}>Показани {first}–{last} от {total}</div>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Предишна страница"
        >
          ‹
        </button>
        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const showGap = previous !== undefined && pageNumber - previous > 1;
          return (
            <span className={styles.pageGroup} key={pageNumber}>
              {showGap && <span className={styles.pageDots}>…</span>}
              <button
                type="button"
                className={`${styles.pageButton} ${pageNumber === page ? styles.pageButtonActive : ""}`}
                onClick={() => onChange(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          aria-label="Следваща страница"
        >
          ›
        </button>
      </div>
    </nav>
  );
}
