import Link from "next/link";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default function CatalogStructurePage() {
  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>МАГАЗИН</span><h1>Каталог</h1><p>Разделихме управлението: секциите са страниците, категориите са филтрите.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
      <Link href="/admin/catalog-sections" style={{ display: "block", padding: 24, borderRadius: 20, background: "#fffdf9", border: "1px solid rgba(92,11,45,.14)", textDecoration: "none", color: "#2b1220" }}>
        <strong style={{ display: "block", fontSize: 28, marginBottom: 8 }}>Секции / страници</strong>
        <span>Създаване, редакция, търсене, подредба и изтриване на страниците в магазина.</span>
      </Link>
      <Link href="/admin/catalog-categories" style={{ display: "block", padding: 24, borderRadius: 20, background: "#fffdf9", border: "1px solid rgba(92,11,45,.14)", textDecoration: "none", color: "#2b1220" }}>
        <strong style={{ display: "block", fontSize: 28, marginBottom: 8 }}>Категории / филтри</strong>
        <span>Категориите са филтри към секциите, не са страници.</span>
      </Link>
    </div>
  </main>;
}
