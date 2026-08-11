/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";
import Image from "next/image";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { markAdminNavAlertItemViewed, markAdminNavAlertItemsViewedBatch } from "@/lib/admin-nav-alert-client";
import styles from "./InventoryTable.module.css";

type Row = {
  id: number;
  size: string;
  sku: string | null;
  stock: number;
  sold: number;
  minStock: number;
  updatedAt: string;
  unread: boolean;
  reserved: number;
  available: number;
  product: {
    name: string;
    imageUrl: string;
  };
};

export default function InventoryTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      if (q && !`${row.product.name} ${row.size} ${row.sku ?? ""}`.toLowerCase().includes(q)) return false;
      if (availability === "OUT" && row.available !== 0) return false;
      if (availability === "LOW" && !(row.available > 0 && row.available <= 5)) return false;
      if (availability === "IN" && row.available <= 5) return false;
      if (availability === "RESERVED" && row.reserved <= 0) return false;
      return true;
    }).sort((a,b) => {
      if (sort === "available-asc") return a.available - b.available;
      if (sort === "available-desc") return b.available - a.available;
      if (sort === "sold-desc") return b.sold - a.sold;
      if (sort === "size") return a.size.localeCompare(b.size, "bg", { numeric: true });
      return a.product.name.localeCompare(b.product.name, "bg");
    });
  }, [rows, query, availability, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paginatedRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, availability, sort]);

  async function adjust(row: Row) {
    const value = prompt(
      `Нова наличност за ${row.product.name}, размер ${row.size}:`,
      String(row.stock),
    );

    if (value === null) return;

    const newStock = Number(value);

    if (!Number.isInteger(newStock) || newStock < 0) {
      setError("Въведи цяло число 0 или повече.");
      return;
    }

    setBusyId(row.id);
    setError("");

    const response = await fetch(
      `/api/admin/inventory/${row.id}/adjust`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStock,
          note: "Ръчна корекция от страница Склад",
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Наличността не беше променена.");
    } else {
      router.refresh();
    }

    setBusyId(null);
  }

  async function acknowledge(row: Row) {
    const newlyViewed = await markAdminNavAlertItemViewed({
      href: "/admin/inventory",
      itemKey: `variant:${row.id}`,
      eventVersion: row.updatedAt,
    });
    if (newlyViewed) setViewedIds((current) => [...current, row.id]);
  }

  async function acknowledgeAll() {
    const unreadRows = rows.filter(
      (row) => row.unread && !viewedIds.includes(row.id),
    );
    if (!unreadRows.length || markingAll) return;

    setMarkingAll(true);
    setError("");

    const markedCount = await markAdminNavAlertItemsViewedBatch({
      items: unreadRows.map((row) => ({
        href: "/admin/inventory",
        itemKey: `variant:${row.id}`,
        eventVersion: row.updatedAt,
      })),
    });

    if (markedCount === unreadRows.length) {
      setViewedIds((current) => [...new Set([...current, ...unreadRows.map((row) => row.id)])]);
    } else if (markedCount > 0) {
      // При частичен успех обновяваме страницата, за да прочетем точния статус от сървъра.
      router.refresh();
      setError("Част от известията бяха маркирани. Статусът се обновява.");
    } else {
      setError("Известията не можаха да бъдат маркирани. Опитай отново.");
    }
    setMarkingAll(false);
  }

  return (
    <>
      <div className={styles.inventoryFilters}>
        <label className={styles.inventorySearch}><span>Търсене</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Продукт, размер или SKU..." /></label>
        <label><span>Наличност</span><select value={availability} onChange={e => setAvailability(e.target.value)}><option value="ALL">Всички</option><option value="IN">Добра наличност</option><option value="LOW">Ниска (1–5)</option><option value="OUT">Изчерпани</option><option value="RESERVED">С резервирани</option></select></label>
        <label><span>Сортиране</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Продукт А–Я</option><option value="available-asc">Свободни ↑</option><option value="available-desc">Свободни ↓</option><option value="sold-desc">Най-продавани</option><option value="size">Размер</option></select></label>
        {(query || availability !== "ALL" || sort !== "name") && <button onClick={() => {setQuery("");setAvailability("ALL");setSort("name");setPage(1);}}>Изчисти</button>}
      </div>
      <div className={styles.inventoryToolbar}>
        <div className={styles.inventoryCount}><strong>{visible.length}</strong> от {rows.length} варианта</div>
        {rows.some((row) => row.unread && !viewedIds.includes(row.id)) ? (
          <button
            type="button"
            className={styles.markAllButton}
            disabled={markingAll}
            onClick={() => void acknowledgeAll()}
          >
            {markingAll ? "Маркиране..." : "Маркирай всичко като прегледано"}
          </button>
        ) : (
          <span className={styles.allViewed}>✓ Всичко е прегледано</span>
        )}
      </div>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {visible.length === 0 ? <div className={styles.empty}>Няма складови позиции с тези филтри.</div> : paginatedRows.map((row) => (
          <article key={row.id} className={`${styles.row} ${row.unread && !viewedIds.includes(row.id) ? styles.unreadRow : ""}`}>
            <Image src={row.product.imageUrl} alt={row.product.name} width={72} height={86} sizes="72px" />

            <div className={styles.product}>
              <strong>{row.product.name}{row.unread && !viewedIds.includes(row.id) ? <span className={styles.newPill}>Ново</span> : null}</strong>
              <span>{row.size}</span>
              <small>{row.sku || "Без SKU"}</small>
            </div>

            <div><span>Склад</span><strong>{row.stock}</strong></div>
            <div><span>Резервирани</span><strong>{row.reserved}</strong></div>
            <div><span>Свободни</span><strong>{row.available}</strong></div>
            <div><span>Продадени</span><strong>{row.sold}</strong></div>

            <div className={styles.rowActions}>
              {row.unread && !viewedIds.includes(row.id) ? <button type="button" className={styles.seenButton} onClick={() => void acknowledge(row)}>Прегледано</button> : null}
              <button
                disabled={busyId === row.id}
                onClick={() => adjust(row)}
              >
                Коригирай
              </button>
            </div>
          </article>
        ))}
      </div>
      <Pagination
        page={currentPage}
        pages={pages}
        total={visible.length}
        pageSize={pageSize}
        onChange={setPage}
      />
    </>
  );
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
    <nav className={styles.pagination} aria-label="Страници с наличности">
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
