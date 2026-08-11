/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./PromoCodesManager.module.css";

type PromoCode = {
  id: number;
  code: string;
  regularDiscountPercent: number;
  saleDiscountPercent: number;
  isActive: boolean;
  createdAt: string | Date;
};

const EMPTY = { code: "", regularDiscountPercent: "10", saleDiscountPercent: "0", isActive: true };

export default function PromoCodesManager({ initialPromoCodes }: { initialPromoCodes: PromoCode[] }) {
  const [promoCodes, setPromoCodes] = useState(initialPromoCodes);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredPromoCodes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleUpperCase("bg-BG");
    return promoCodes.filter((promo) => {
      const matchesQuery = !normalizedQuery || promo.code.toLocaleUpperCase("bg-BG").includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? promo.isActive : !promo.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [promoCodes, query, statusFilter]);

  const pages = Math.max(1, Math.ceil(filteredPromoCodes.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paginatedPromoCodes = filteredPromoCodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function startEdit(promo: PromoCode) {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      regularDiscountPercent: String(promo.regularDiscountPercent),
      saleDiscountPercent: String(promo.saleDiscountPercent),
      isActive: promo.isActive,
    });
    setError(""); setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    const url = editingId ? `/api/admin/promo-codes/${editingId}` : "/api/admin/promo-codes";
    const response = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        regularDiscountPercent: Number(form.regularDiscountPercent),
        saleDiscountPercent: Number(form.saleDiscountPercent),
        isActive: form.isActive,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error || "Промокодът не беше запазен."); return; }
    const promo = data.promo as PromoCode;
    setPromoCodes((current) => editingId ? current.map((item) => item.id === promo.id ? promo : item) : [promo, ...current]);
    setMessage(editingId ? "Промокодът е обновен." : "Промокодът е създаден.");
    setEditingId(null); setForm(EMPTY);
  }

  async function remove(id: number) {
    if (!confirm("Да изтрия ли този промокод?")) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error || "Промокодът не беше изтрит."); return; }
    setPromoCodes((current) => current.filter((item) => item.id !== id));
    if (editingId === id) reset();
    setMessage("Промокодът е изтрит.");
  }

  return <div className={styles.wrap}>
    <section className={styles.editor}>
      <div className={styles.editorTitle}>
        <div><span>{editingId ? "РЕДАКЦИЯ" : "НОВ ПРОМОКОД"}</span><h2>{editingId ? "Промени промокода" : "Създай промокод"}</h2></div>
        {editingId && <button type="button" className={styles.secondary} onClick={reset}>Откажи редакцията</button>}
      </div>
      <div className={styles.grid}>
        <label className={styles.code}>Име на промокода<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="напр. STORE10" maxLength={60} /></label>
        <label>Отстъпка за стоки без намаление (%)<input type="number" min="0" max="100" step="0.01" value={form.regularDiscountPercent} onChange={(e) => setForm({ ...form, regularDiscountPercent: e.target.value })} /></label>
        <label>Отстъпка за вече намалени стоки (%)<input type="number" min="0" max="100" step="0.01" value={form.saleDiscountPercent} onChange={(e) => setForm({ ...form, saleDiscountPercent: e.target.value })} /></label>
      </div>
      <label className={styles.active}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span><strong>Активен промокод</strong><small>Неактивният код остава в списъка, но не може да се използва при checkout.</small></span></label>
      <div className={styles.help}>Ако продуктът вече е намален (има по-висока стара цена), се използва процентът за „вече намалени стоки“. За всички останали се използва първият процент.</div>
      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.success}>{message}</div>}
      <button type="button" className={styles.primary} onClick={save} disabled={busy}>{busy ? "Запазване..." : editingId ? "Запази промените" : "Създай промокода"}</button>
    </section>

    <section className={styles.list}>
      <div className={styles.listHeading}><div><span>СЪЗДАДЕНИ КОДОВЕ</span><h2>Промокодове</h2></div><b>{promoCodes.length}</b></div>

      <div className={styles.filters}>
        <label className={styles.searchField}>
          <span>ТЪРСЕНЕ</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси по код..."
          />
        </label>
        <label className={styles.filterField}>
          <span>СТАТУС</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}>
            <option value="all">Всички</option>
            <option value="active">Активни</option>
            <option value="inactive">Неактивни</option>
          </select>
        </label>
      </div>

      {promoCodes.length === 0 ? (
        <p className={styles.empty}>Все още няма създадени промокодове.</p>
      ) : filteredPromoCodes.length === 0 ? (
        <p className={styles.empty}>Няма промокодове, които отговарят на избраните филтри.</p>
      ) : (
        <>
          <div className={styles.cards}>{paginatedPromoCodes.map((promo) => <article key={promo.id} className={!promo.isActive ? styles.inactive : ""}>
            <div className={styles.codeRow}><strong>{promo.code}</strong><span>{promo.isActive ? "Активен" : "Неактивен"}</span></div>
            <div className={styles.values}><p><small>Без намаление</small><b>-{promo.regularDiscountPercent}%</b></p><p><small>Вече намалени</small><b>-{promo.saleDiscountPercent}%</b></p></div>
            <div className={styles.actions}><button type="button" onClick={() => startEdit(promo)}>Редактирай</button><button type="button" className={styles.delete} onClick={() => remove(promo.id)} disabled={busy}>Изтрий</button></div>
          </article>)}</div>
          <Pagination page={currentPage} pages={pages} total={filteredPromoCodes.length} pageSize={pageSize} onChange={setPage} />
        </>
      )}
    </section>
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
    <nav className={styles.pagination} aria-label="Страници с промокодове">
      <div className={styles.paginationInfo}>Показани {first}–{last} от {total}</div>
      <div className={styles.paginationControls}>
        <button type="button" className={styles.pageButton} onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Предишна страница">‹</button>
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
        <button type="button" className={styles.pageButton} onClick={() => onChange(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Следваща страница">›</button>
      </div>
    </nav>
  );
}
