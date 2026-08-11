/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./CmsContentTypesManager.module.css";

type CmsField = { id?: number; name: string; key: string; type: string; description?: string; isRequired: boolean; isUnique: boolean; isMultiple: boolean };
type CmsType = { id: number; name: string; singularName: string; slug: string; description: string; icon: string; status: string; fields: CmsField[]; _count: { entries: number } };
const FIELD_TYPES = ["TEXT", "RICH_TEXT", "NUMBER", "PRICE", "BOOLEAN", "DATE", "IMAGE", "GALLERY", "VIDEO", "RELATION", "SELECT", "MULTI_SELECT", "JSON", "FILE"];
const blankField = (): CmsField => ({ name: "Заглавие", key: "title", type: "TEXT", isRequired: true, isUnique: false, isMultiple: false });

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return { error: `Сървърът върна невалиден отговор (${response.status}).` };
  }
}

export default function CmsContentTypesManager() {
  const [items, setItems] = useState<CmsType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", singularName: "", slug: "", description: "", icon: "▦", status: "ACTIVE", fields: [blankField()] as CmsField[] });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/cms/content-types", { cache: "no-store" });
      const json = await readJsonResponse(response);
      if (response.ok) {
        setItems(Array.isArray(json.contentTypes) ? json.contentTypes as CmsType[] : []);
      } else {
        setMessage(typeof json.error === "string" ? json.error : `CMS моделите не могат да бъдат заредени (${response.status}).`);
      }
    } catch {
      setMessage("Няма връзка с CMS API. Проверете сървъра и базата данни.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  function edit(item: CmsType) { setSelectedId(item.id); setForm({ name: item.name, singularName: item.singularName, slug: item.slug, description: item.description, icon: item.icon, status: item.status, fields: item.fields.map((f) => ({ ...f })) }); setMessage(""); }
  function reset() { setSelectedId(null); setForm({ name: "", singularName: "", slug: "", description: "", icon: "▦", status: "ACTIVE", fields: [blankField()] }); setMessage(""); }
  function setField(index: number, patch: Partial<CmsField>) { setForm((current) => ({ ...current, fields: current.fields.map((field, i) => i === index ? { ...field, ...patch } : field) })); }
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const wasEditing = selectedId !== null;
      const response = await fetch("/api/admin/cms/content-types", { method: wasEditing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: selectedId }) });
      const json = await readJsonResponse(response);
      if (!response.ok) return setMessage(typeof json.error === "string" ? json.error : `Записът беше неуспешен (${response.status}).`);
      await load();
      reset();
      setMessage(wasEditing ? "CMS моделът е обновен." : "CMS моделът е създаден.");
    } catch {
      setMessage("Няма връзка с CMS API. Записът не беше извършен.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: CmsType) {
    if (!window.confirm(`Да изтрия ли CMS модела „${item.name}“?`)) return;
    try {
      const response = await fetch(`/api/admin/cms/content-types?id=${item.id}`, { method: "DELETE" });
      const json = await readJsonResponse(response);
      if (!response.ok) return setMessage(typeof json.error === "string" ? json.error : `Изтриването беше неуспешно (${response.status}).`);
      if (selectedId === item.id) reset();
      await load();
      setMessage("CMS моделът е изтрит.");
    } catch {
      setMessage("Няма връзка с CMS API. Изтриването не беше извършено.");
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>UNIVERSAL CMS ENGINE</span><h1>Content Model Studio</h1><p>Създавай типове съдържание и техните полета без промени по кода.</p></div><button className={styles.primary} onClick={reset}>+ Нов модел</button></header>
    {message && <div className={styles.message}>{message}</div>}
    <div className={styles.layout}>
      <section className={styles.listPanel}><div className={styles.panelTitle}><h2>Content Types</h2><span>{items.length}</span></div>
        {loading ? <p className={styles.muted}>Зареждане…</p> : items.length === 0 ? <div className={styles.empty}><strong>Все още няма CMS модели</strong><span>Създай „Новини“, „Услуги“, „Екип“ или друг тип съдържание.</span></div> : items.map((item) => <article key={item.id} className={`${styles.card} ${selectedId === item.id ? styles.active : ""}`}>
          <button className={styles.cardMain} onClick={() => edit(item)}><span className={styles.icon}>{item.icon}</span><span><strong>{item.name}</strong><small>/{item.slug} · {item.fields.length} полета · {item._count.entries} записа</small></span></button>
          <span className={item.status === "ACTIVE" ? styles.status : styles.statusOff}>{item.status === "ACTIVE" ? "Активен" : "Спрян"}</span><Link className={styles.manage} href={`/admin/cms/${item.id}`}>Съдържание</Link><button className={styles.delete} onClick={() => void remove(item)}>×</button>
        </article>)}
      </section>
      <section className={styles.editor}><div className={styles.panelTitle}><div><h2>{selected ? `Редакция: ${selected.name}` : "Нов Content Type"}</h2><p>Структурата се използва от следващите CMS модули за записи, колекции и публични страници.</p></div></div>
        <div className={styles.grid}><label>Име в множествено число<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Новини" /></label><label>Име в единствено число<input value={form.singularName} onChange={(e) => setForm({ ...form, singularName: e.target.value })} placeholder="Новина" /></label><label>Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="news" /></label><label>Икона<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></label><label className={styles.full}>Описание<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Статус<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="ACTIVE">Активен</option><option value="INACTIVE">Спрян</option></select></label></div>
        <div className={styles.fieldsHead}><div><h3>Полета</h3><p>Ключовете се използват в API и шаблоните.</p></div><button onClick={() => setForm({ ...form, fields: [...form.fields, { name: "Ново поле", key: `field_${form.fields.length + 1}`, type: "TEXT", isRequired: false, isUnique: false, isMultiple: false }] })}>+ Добави поле</button></div>
        <div className={styles.fields}>{form.fields.map((field, index) => <div className={styles.fieldRow} key={`${field.key}-${index}`}>
          <span className={styles.order}>{index + 1}</span>
          <div className={styles.fieldInputs}>
            <input value={field.name} onChange={(e) => setField(index, { name: e.target.value })} aria-label="Име на поле" />
            <input value={field.key} onChange={(e) => setField(index, { key: e.target.value })} aria-label="Ключ на поле" />
            <select value={field.type} onChange={(e) => setField(index, { type: e.target.value })} aria-label="Тип на поле">{FIELD_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          </div>
          <div className={styles.fieldOptions}>
            <label className={styles.check}><input type="checkbox" checked={field.isRequired} onChange={(e) => setField(index, { isRequired: e.target.checked })} /><span>Задължително</span></label>
            <label className={styles.check}><input type="checkbox" checked={field.isUnique} onChange={(e) => setField(index, { isUnique: e.target.checked })} /><span>Уникално</span></label>
          </div>
          <button type="button" className={styles.removeField} disabled={form.fields.length === 1} onClick={() => setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) })}>Премахни</button>
        </div>)}</div>
        <footer className={styles.actions}><button onClick={reset}>Отказ</button><button className={styles.primary} disabled={saving} onClick={() => void save()}>{saving ? "Записване…" : selected ? "Запази промените" : "Създай CMS модел"}</button></footer>
      </section>
    </div>
  </main>;
}
