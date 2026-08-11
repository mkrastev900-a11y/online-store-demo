"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./AdminGlobalSearch.module.css";

type Result = { type: "product" | "order" | "customer"; id: number; title: string; subtitle: string; href: string };

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
      if (response.ok) { const data = await response.json(); setResults(data.results ?? []); setOpen(true); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <div className={styles.wrapper} ref={wrapper}>
    <input value={query} onChange={(e) => { const value = e.target.value; setQuery(value); if (value.trim().length < 2) setResults([]); }} onFocus={() => setOpen(true)} placeholder="Търси продукт, клиент или поръчка…" aria-label="Глобално търсене" />
    {open && query.trim().length >= 2 && <div className={styles.results}>{results.length ? results.map((result) => <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => setOpen(false)}><span>{result.type === "product" ? "ПРОДУКТ" : result.type === "order" ? "ПОРЪЧКА" : "КЛИЕНТ"}</span><strong>{result.title}</strong><small>{result.subtitle}</small></Link>) : <p>Няма намерени резултати.</p>}</div>}
  </div>;
}
