/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./CmsEntriesManager.module.css";

type CmsField = { id: number; name: string; key: string; type: string; description: string; isRequired: boolean; isUnique: boolean; isMultiple: boolean; settings?: unknown; defaultValue?: unknown };
type CmsType = { id: number; name: string; singularName: string; slug: string; description: string; icon: string; status: string; fields: CmsField[] };
type CmsEntry = { id: number; title: string; slug: string; status: string; data: Record<string, unknown>; seo: Record<string, unknown>; publishedAt: string | null; updatedAt: string };

type EntryForm = { id: number | null; title: string; slug: string; status: string; data: Record<string, unknown> };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { return { error: `Сървърът върна невалиден отговор (${response.status}).` }; }
}

function initialData(fields: CmsField[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.isMultiple ? [] : field.type === "BOOLEAN" ? false : field.defaultValue ?? ""]));
}

function asText(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export default function CmsEntriesManager({ contentTypeId }: { contentTypeId: number }) {
  const [contentType, setContentType] = useState<CmsType | null>(null);
  const [entries, setEntries] = useState<CmsEntry[]>([]);
  const [form, setForm] = useState<EntryForm>({ id: null, title: "", slug: "", status: "DRAFT", data: {} });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => entries.find((entry) => entry.id === form.id) ?? null, [entries, form.id]);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const params = new URLSearchParams({ q: query, status: statusFilter });
      const response = await fetch(`/api/admin/cms/content-types/${contentTypeId}/entries?${params}`, { cache: "no-store" });
      const json = await readJson(response);
      if (!response.ok) return setMessage(typeof json.error === "string" ? json.error : "Съдържанието не може да бъде заредено.");
      const type = json.contentType as CmsType;
      setContentType(type);
      setEntries(Array.isArray(json.entries) ? json.entries as CmsEntry[] : []);
      setForm((current) => current.id === null && Object.keys(current.data).length === 0 ? { ...current, data: initialData(type.fields) } : current);
    } catch { setMessage("Няма връзка с CMS API."); }
    finally { setLoading(false); }
  }

  // Query changes are intentionally submitted by Enter/Търси; auto-loading on each keystroke would change UX.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [contentTypeId, statusFilter]);

  function reset() {
    setForm({ id: null, title: "", slug: "", status: "DRAFT", data: initialData(contentType?.fields ?? []) });
    setMessage("");
  }

  function edit(entry: CmsEntry) {
    setForm({ id: entry.id, title: entry.title, slug: entry.slug, status: entry.status, data: { ...initialData(contentType?.fields ?? []), ...(entry.data ?? {}) } });
    setMessage("");
  }

  function setValue(key: string, value: unknown) {
    setForm((current) => ({ ...current, data: { ...current.data, [key]: value } }));
  }

  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/cms/content-types/${contentTypeId}/entries`, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await readJson(response);
      if (!response.ok) return setMessage(typeof json.error === "string" ? json.error : "Записът беше неуспешен.");
      await load(); reset(); setMessage(form.id ? "Записът е обновен." : "Записът е създаден.");
    } catch { setMessage("Няма връзка с CMS API."); }
    finally { setSaving(false); }
  }

  async function remove(entry: CmsEntry) {
    if (!window.confirm(`Да изтрия ли „${entry.title}“?`)) return;
    const response = await fetch(`/api/admin/cms/content-types/${contentTypeId}/entries?entryId=${entry.id}`, { method: "DELETE" });
    const json = await readJson(response);
    if (!response.ok) return setMessage(typeof json.error === "string" ? json.error : "Изтриването беше неуспешно.");
    if (form.id === entry.id) reset();
    await load(); setMessage("Записът е изтрит.");
  }

  function renderField(field: CmsField) {
    const value = form.data[field.key];
    const common = { id: `cms-${field.key}`, "aria-label": field.name };
    if (field.type === "BOOLEAN") return <input {...common} type="checkbox" checked={Boolean(value)} onChange={(event) => setValue(field.key, event.target.checked)} />;
    if (field.type === "RICH_TEXT") return <textarea {...common} rows={7} value={asText(value)} onChange={(event) => setValue(field.key, event.target.value)} />;
    if (field.type === "JSON") return <textarea {...common} rows={6} value={asText(value)} onChange={(event) => { try { setValue(field.key, JSON.parse(event.target.value)); } catch { setValue(field.key, event.target.value); } }} />;
    if (field.type === "NUMBER" || field.type === "PRICE") return <input {...common} type="number" step={field.type === "PRICE" ? "0.01" : "any"} value={typeof value === "number" ? value : asText(value)} onChange={(event) => setValue(field.key, event.target.value === "" ? "" : Number(event.target.value))} />;
    if (field.type === "DATE") return <input {...common} type="date" value={asText(value).slice(0, 10)} onChange={(event) => setValue(field.key, event.target.value)} />;
    if (["GALLERY", "MULTI_SELECT"].includes(field.type) || field.isMultiple) return <textarea {...common} rows={3} value={Array.isArray(value) ? value.join("\n") : asText(value)} onChange={(event) => setValue(field.key, event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} placeholder="Една стойност на ред" />;
    return <input {...common} type={field.type === "VIDEO" || field.type === "IMAGE" || field.type === "FILE" ? "url" : "text"} value={asText(value)} onChange={(event) => setValue(field.key, event.target.value)} />;
  }

  if (!Number.isInteger(contentTypeId)) return <main className={styles.page}><div className={styles.message}>Невалиден CMS модел.</div></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>DYNAMIC CONTENT MANAGER</span><h1>{contentType ? `${contentType.icon} ${contentType.name}` : "CMS съдържание"}</h1><p>{contentType?.description || "Създавай, редактирай и публикувай динамично съдържание."}</p></div>
      <div className={styles.headerActions}><Link href="/admin/cms">← Content Models</Link><button className={styles.primary} onClick={reset}>+ Нов запис</button></div>
    </header>
    {message && <div className={styles.message}>{message}</div>}
    <div className={styles.layout}>
      <section className={styles.listPanel}>
        <div className={styles.filters}><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="Търсене…" /><button onClick={() => void load()}>Търси</button><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Всички</option><option value="DRAFT">Чернови</option><option value="PUBLISHED">Публикувани</option><option value="ARCHIVED">Архивирани</option></select></div>
        <div className={styles.panelTitle}><h2>Записи</h2><span>{entries.length}</span></div>
        {loading ? <p className={styles.muted}>Зареждане…</p> : entries.length === 0 ? <div className={styles.empty}>Все още няма записи.</div> : entries.map((entry) => <article key={entry.id} className={`${styles.entryCard} ${form.id === entry.id ? styles.active : ""}`}>
          <button className={styles.entryMain} onClick={() => edit(entry)}><strong>{entry.title}</strong><small>/{entry.slug} · {new Date(entry.updatedAt).toLocaleString("bg-BG")}</small></button>
          <span className={`${styles.badge} ${styles[entry.status.toLowerCase()] ?? ""}`}>{entry.status === "PUBLISHED" ? "Публикуван" : entry.status === "ARCHIVED" ? "Архивиран" : "Чернова"}</span>
          <button className={styles.delete} onClick={() => void remove(entry)}>×</button>
        </article>)}
      </section>
      <section className={styles.editor}>
        <div className={styles.panelTitle}><div><h2>{selected ? `Редакция: ${selected.title}` : `Нов ${contentType?.singularName ?? "запис"}`}</h2><p>Формата е генерирана автоматично от Content Model Studio.</p></div></div>
        <div className={styles.baseGrid}><label>Заглавие<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="генерира се от заглавието" /></label><label>Статус<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="DRAFT">Чернова</option><option value="PUBLISHED">Публикуван</option><option value="ARCHIVED">Архивиран</option></select></label></div>
        <div className={styles.dynamicFields}>{contentType?.fields.map((field) => <label key={field.id} className={field.type === "BOOLEAN" ? styles.booleanField : ""}><span>{field.name}{field.isRequired ? " *" : ""}</span>{renderField(field)}{field.description && <small>{field.description}</small>}</label>)}</div>
        <footer className={styles.actions}><button onClick={reset}>Отказ</button><button className={styles.primary} disabled={saving} onClick={() => void save()}>{saving ? "Записване…" : selected ? "Запази промените" : "Създай запис"}</button></footer>
      </section>
    </div>
  </main>;
}
