import Link from "next/link";
import styles from "@/app/admin/accounting/accounting.module.css";

export default function AccountingPagination({
  path,
  page,
  pages,
  total,
  pageSize,
  paramName,
  query,
}: {
  path: string;
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  paramName: string;
  query: Record<string, string | undefined>;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (target > 1) params.set(paramName, String(target)); else params.delete(paramName);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav className={styles.pagination} data-print-hidden aria-label="Странициране">
      <span className={styles.paginationInfo}>Показани {first}–{last} от {total}</span>
      <div className={styles.paginationButtons}>
        <Link className={`${styles.pageButton} ${page <= 1 ? styles.pageDisabled : ""}`} href={page <= 1 ? hrefFor(1) : hrefFor(page - 1)} aria-disabled={page <= 1}>← Предишна</Link>
        {visible.map((n, index) => {
          const prev = visible[index - 1];
          return <span key={n} className={styles.pageNumberWrap}>{prev && n - prev > 1 ? <span className={styles.pageEllipsis}>…</span> : null}<Link className={`${styles.pageNumber} ${n === page ? styles.pageActive : ""}`} href={hrefFor(n)}>{n}</Link></span>;
        })}
        <Link className={`${styles.pageButton} ${page >= pages ? styles.pageDisabled : ""}`} href={page >= pages ? hrefFor(pages) : hrefFor(page + 1)} aria-disabled={page >= pages}>Следваща →</Link>
      </div>
    </nav>
  );
}
