/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./CatalogStructureManager.module.css";

type Audience = "WOMEN" | "MEN" | "KIDS";
type Mode = "sections" | "categories" | "all";
type Section = { id: number; name: string; slug: string; eyebrow: string; description: string; baseAudience?: Audience; isSystem: boolean; isActive: boolean; sortOrder: number; _count?: { categories: number; products: number } };
type Category = { id: number; name: string; slug: string; sectionId: number | null; section?: { id: number; name: string; slug: string } | null; _count?: { products: number } };

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "");
}

function textMatches(value: string, query: string) {
  if (!query.trim()) return true;
  return value.toLocaleLowerCase("bg").includes(query.trim().toLocaleLowerCase("bg"));
}

export default function CatalogStructureManager({
  initialSections,
  initialCategories,
  mode = "all",
}: {
  initialSections: Section[];
  initialCategories: Category[];
  mode?: Mode;
}) {
  const [sections, setSections] = useState(initialSections);
  const [categories, setCategories] = useState(initialCategories);
  const [sectionQuery, setSectionQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categorySectionFilter, setCategorySectionFilter] = useState("ALL");
  const [categoryPage, setCategoryPage] = useState(1);
  const [message, setMessage] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const activeSections = useMemo(() => sections.filter((section) => section.isActive), [sections]);

  const sectionPageOptions = useMemo(() => {
    const fixed = [
      { value: "women", label: "Дамско — /women" },
      { value: "men", label: "Мъжко — /men" },
      { value: "kids", label: "Детско — /kids" },
      { value: "new", label: "Нови — /new" },
      { value: "sale", label: "Промоции — /sale" },
    ];
    const seen = new Set(fixed.map((item) => item.value));
    const dynamic = sections
      .filter((section) => section.slug && !seen.has(section.slug))
      .map((section) => ({ value: section.slug, label: `${section.name} — /${section.slug}` }));
    return [...fixed, ...dynamic];
  }, [sections]);

  const filteredSections = useMemo(() => {
    return sections.filter((section) => textMatches(`${section.name} ${section.slug} ${section.eyebrow} ${section.description}`, sectionQuery));
  }, [sections, sectionQuery]);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const section = sections.find((item) => item.id === category.sectionId) ?? category.section ?? null;
      const matchesText = textMatches(`${category.name} ${category.slug} ${section?.name ?? ""} ${section?.slug ?? ""}`, categoryQuery);
      const matchesSection = categorySectionFilter === "ALL" || String(category.sectionId ?? "NONE") === categorySectionFilter;
      return matchesText && matchesSection;
    });
  }, [categories, sections, categoryQuery, categorySectionFilter]);

  const categoryPageSize = 5;
  const categoryPages = Math.max(1, Math.ceil(filteredCategories.length / categoryPageSize));
  const currentCategoryPage = Math.min(categoryPage, categoryPages);
  const paginatedCategories = useMemo(() => {
    const start = (currentCategoryPage - 1) * categoryPageSize;
    return filteredCategories.slice(start, start + categoryPageSize);
  }, [filteredCategories, currentCategoryPage]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categoryQuery, categorySectionFilter]);

  useEffect(() => {
    setCategoryPage((current) => Math.min(current, categoryPages));
  }, [categoryPages]);

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const response = await fetch("/api/admin/catalog-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: String(form.get("pageSlug") || "") === "__auto__" ? slugify(name) : String(form.get("pageSlug") || slugify(name)),
        eyebrow: form.get("eyebrow"),
        description: form.get("description"),
      }),
    });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Секцията не беше създадена."); return; }
    setSections((current) => [...current, result.section].sort((a,b)=>a.sortOrder-b.sortOrder || a.name.localeCompare(b.name, "bg")));
    (event.currentTarget as HTMLFormElement).reset();
    setMessage("Секцията е създадена като самостоятелна страница. Тя не е вързана към Мъжко/Дамско/Детско.");
  }

  async function updateSection(section: Section, patch: Partial<Section>) {
    const response = await fetch(`/api/admin/catalog-sections/${section.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Секцията не беше обновена."); return; }
    setSections((current) => current.map((item) => item.id === section.id ? { ...item, ...result.section } : item));
    setMessage("Секцията е запазена.");
  }

  async function deleteSection(section: Section) {
    if (!confirm(`Да премахна секция „${section.name}“?`)) return;
    const response = await fetch(`/api/admin/catalog-sections/${section.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Секцията не беше премахната."); return; }
    if (result.deleted) setSections((current) => current.filter((item) => item.id !== section.id));
    else setSections((current) => current.map((item) => item.id === section.id ? { ...item, isActive: false } : item));
    setMessage(result.archived ? "Секцията има връзки и беше скрита, вместо окончателно изтрита." : "Секцията е изтрита.");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingCategory) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    setMessage("");
    setCreatingCategory(true);
    try {
      const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: form.get("slug") || slugify(name), sectionId: form.get("sectionId") }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Категорията не беше създадена."); return; }
      setCategories((current) => [...current.filter((item) => item.id !== result.category.id), result.category].sort((a,b)=>a.name.localeCompare(b.name, "bg")));
      formElement.reset();
      setCategoryQuery("");
      setCategorySectionFilter("ALL");
      setMessage("Категорията е създадена успешно.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function updateCategory(category: Category, patch: Partial<Category>) {
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Категорията не беше обновена."); return; }
    setCategories((current) => current.map((item) => item.id === category.id ? { ...item, ...result.category } : item));
    setMessage("Категорията е запазена.");
  }

  async function saveSectionFromForm(section: Section, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateSection(section, {
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("pageSlug") ?? section.slug).trim(),
      eyebrow: String(form.get("eyebrow") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      isActive: String(form.get("isActive") ?? "1") === "1",
    });
  }

  async function saveCategoryFromForm(category: Category, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingCategoryId === category.id) return;
    const form = new FormData(event.currentTarget);
    setSavingCategoryId(category.id);
    try {
      await updateCategory(category, {
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        sectionId: Number(form.get("sectionId")) > 0 ? Number(form.get("sectionId")) : null,
      });
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (deletingCategoryId === category.id) return;
    if (!confirm(`Да изтрия категория „${category.name}“?`)) return;
    const previousCategories = categories;
    setMessage("");
    setDeletingCategoryId(category.id);
    setCategories((current) => current.filter((item) => item.id !== category.id));
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCategories(previousCategories);
        setMessage(result.error || "Категорията не беше изтрита.");
        return;
      }
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage("Категорията е изтрита успешно.");
    } catch {
      setCategories(previousCategories);
      setMessage("Категорията не беше изтрита. Провери връзката и опитай отново.");
    } finally {
      setDeletingCategoryId(null);
    }
  }

  const showSections = mode === "sections" || mode === "all";
  const showCategories = mode === "categories" || mode === "all";

  return <div className={styles.wrapper}>
    {message && <div className={styles.message}>{message}</div>}
    {showSections && <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Секции / страници</h2>
          <p>Секцията е самостоятелна страница на магазина. „Дамско“, „Мъжко“, „Детско“, „Обувки“ и „Аксесоари“ са равноправни секции.</p>
        </div>
        <label className={styles.searchBox}>Търси секция<input value={sectionQuery} onChange={(event) => setSectionQuery(event.currentTarget.value)} placeholder="име, път, описание..." /></label>
      </div>
      <form className={styles.formGrid} onSubmit={createSection}>
        <label>Име<input name="name" placeholder="Обувки" required /></label>
        <label>Страница<select name="pageSlug" defaultValue="__auto__"><option value="__auto__">Създай нова страница от името</option>{sectionPageOptions.map((page)=><option key={page.value} value={page.value}>{page.label}</option>)}</select></label>
        <label>Малък надпис<input name="eyebrow" placeholder="ОБУВКИ" /></label>
        <button type="submit">+ Създай секция</button>
        <label className={styles.wideField}>Описание<input name="description" placeholder="Всички обувки в магазина" /></label>
      </form>
      <div className={styles.list}>{filteredSections.map((section) => <form className={styles.sectionRow} key={section.id} onSubmit={(event)=>saveSectionFromForm(section, event)}>
        <label>Име<input name="name" defaultValue={section.name} /></label>
        <label>Страница<select name="pageSlug" defaultValue={section.slug}>{sectionPageOptions.some((page)=>page.value===section.slug) ? null : <option value={section.slug}>Текуща — /{section.slug}</option>}{sectionPageOptions.map((page)=><option key={page.value} value={page.value}>{page.label}</option>)}</select></label>
        <label>Малък надпис<input name="eyebrow" defaultValue={section.eyebrow} /></label>
        <label>Описание<textarea name="description" defaultValue={section.description} /></label>
        <label>Активна<select name="isActive" defaultValue={section.isActive ? "1" : "0"}><option value="1">Да</option><option value="0">Не</option></select></label>
        <div className={styles.actions}><button type="submit">Запази</button><button type="button" onClick={()=>updateSection(section,{sortOrder: section.sortOrder-10})}>↑</button><button type="button" onClick={()=>updateSection(section,{sortOrder: section.sortOrder+10})}>↓</button><button type="button" className={styles.danger} onClick={()=>deleteSection(section)} disabled={section.isSystem}>Изтрий</button></div>
        <div className={styles.meta}>Страница: /{section.slug} · категории: {section._count?.categories ?? 0} · продукти: {section._count?.products ?? 0}</div>
      </form>)}</div>
      {filteredSections.length === 0 && <p className={styles.empty}>Няма секции по това търсене.</p>}
    </section>}

    {showCategories && <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Категории / филтри</h2>
          <p>Категорията не е страница. Тя е филтър вътре в избрана секция.</p>
        </div>
        <div className={styles.filterBar}>
          <label className={styles.searchBox}>Търси категория<input value={categoryQuery} onChange={(event) => setCategoryQuery(event.currentTarget.value)} placeholder="име, slug, секция..." /></label>
          <label className={styles.searchBox}>Филтър по секция<select value={categorySectionFilter} onChange={(event) => setCategorySectionFilter(event.currentTarget.value)}><option value="ALL">Всички секции</option><option value="NONE">Без секция</option>{sections.map((section)=><option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
        </div>
      </div>
      <form className={styles.formGrid} onSubmit={createCategory}>
        <label>Име<input name="name" placeholder="Маратонки" required /></label>
        <label>Slug<input name="slug" placeholder="maratonki" /></label>
        <label>Секция<select name="sectionId"><option value="">Без секция засега</option>{activeSections.map((section)=><option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
        <button type="submit" disabled={creatingCategory}>{creatingCategory ? "Създаване…" : "+ Създай категория"}</button>
      </form>
      <div className={styles.list}>{paginatedCategories.map((category)=>{
        const section = sections.find((item) => item.id === category.sectionId) ?? category.section ?? null;
        return <form className={styles.categoryRow} key={category.id} onSubmit={(event)=>saveCategoryFromForm(category, event)}>
          <label>Име<input name="name" defaultValue={category.name} /></label>
          <label>Slug<input name="slug" defaultValue={category.slug} /></label>
          <label>Секция<select name="sectionId" defaultValue={category.sectionId ?? ""}><option value="">Без секция</option>{sections.map((section)=><option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
          <div className={styles.meta}>Секция: {section?.name ?? "без секция"} · продукти: {category._count?.products ?? 0}</div>
          <div className={styles.actions}><button type="submit" disabled={savingCategoryId === category.id || deletingCategoryId === category.id}>{savingCategoryId === category.id ? "Запазване…" : "Запази"}</button><button type="button" className={styles.danger} onClick={()=>deleteCategory(category)} disabled={deletingCategoryId === category.id || savingCategoryId === category.id}>{deletingCategoryId === category.id ? "Изтриване…" : "Изтрий"}</button></div>
        </form>})}</div>
      {filteredCategories.length === 0 && <p className={styles.empty}>Няма категории по това търсене.</p>}
      {filteredCategories.length > categoryPageSize && <CategoryPagination
        page={currentCategoryPage}
        pages={categoryPages}
        total={filteredCategories.length}
        pageSize={categoryPageSize}
        onChange={setCategoryPage}
      />}
    </section>}
  </div>;
}

function CategoryPagination({
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
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter((value) => {
    if (pages <= 7) return true;
    return value === 1 || value === pages || Math.abs(value - page) <= 1;
  });

  return (
    <nav className={styles.pagination} aria-label="Страници с категории">
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

