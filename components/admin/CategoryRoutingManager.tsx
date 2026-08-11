"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PageLinkOption } from "./PageLinkField";
import styles from "./CatalogSettingsManager.module.css";

type Category = { id: number; name: string; slug: string };

type Props = {
  initialCategories: Category[];
  initialMap: Record<string, string>;
  pageOptions: PageLinkOption[];
};

function slugify(value: string) {
  return value.trim().toLocaleLowerCase("bg-BG")
    .replace(/[ъ]/g, "a")
    .replace(/[а-я]/g, (letter) => ({а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sht",ь:"y",ю:"yu",я:"ya"} as Record<string,string>)[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `category-${Date.now()}`;
}

export default function CategoryRoutingManager({ initialCategories, initialMap, pageOptions }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [map, setMap] = useState(initialMap);
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const pages = pageOptions.filter((option) => option.value.startsWith("/"));

  async function saveRouting(nextMap = map) {
    setMessage("");
    const response = await fetch("/api/admin/catalog/category-routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map: nextMap }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Грешка при запис.");
      return false;
    }
    setMessage("Насочването е записано.");
    router.refresh();
    return true;
  }

  async function createCategory() {
    const name = newName.trim();
    const slug = slugify(newSlug || name);
    if (!name) {
      setMessage("Въведи име на категория.");
      return;
    }
    const response = await fetch("/api/admin/catalog/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Категорията не беше създадена.");
      return;
    }
    setCategories((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name, "bg")));
    setNewName("");
    setNewSlug("");
    setMessage("Категорията е създадена.");
    router.refresh();
  }

  async function updateCategory(category: Category) {
    const response = await fetch(`/api/admin/catalog/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: category.name, slug: category.slug }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Категорията не беше записана.");
      return;
    }
    setCategories((current) => current.map((item) => item.id === category.id ? result.category : item));
    setMessage("Категорията е записана.");
    router.refresh();
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Да изтрия ли категорията „${category.name}“? Ако има продукти, системата ще откаже.`)) return;
    const response = await fetch(`/api/admin/catalog/categories/${category.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Категорията не беше изтрита.");
      return;
    }
    const nextMap = { ...map };
    delete nextMap[category.slug];
    setMap(nextMap);
    setCategories((current) => current.filter((item) => item.id !== category.id));
    await saveRouting(nextMap);
    setMessage("Категорията е изтрита.");
  }

  return <div className={styles.wrap}>
    {message ? <div className={styles.message}>{message}</div> : null}
    <section className={styles.card}>
      <div className={styles.heading}><div><span>СТРАНИЦИ И КАТЕГОРИИ</span><h2>Насочване на категории</h2></div><p>Избери към коя магазинска страница да отива всяка категория. Така филтрите и артикулите ще се показват на правилното място.</p></div>
      <div className={styles.levelHint}><b>Логика:</b> страницата е празна, докато към нея няма насочена категория. Продуктът влиза в страницата чрез категорията си.</div>
      <div className={styles.list}>
        {categories.map((category, index) => <div className={styles.row} key={category.id}>
          <input value={category.name} onChange={(event) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          <input value={category.slug} onChange={(event) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, slug: slugify(event.target.value) } : item))} />
          <select value={map[category.slug] || ""} onChange={(event) => setMap((current) => ({ ...current, [category.slug]: event.target.value }))}>
            <option value="">Без насочена страница</option>
            {pages.map((page) => <option key={page.value} value={page.value}>{page.label} — {page.value}</option>)}
          </select>
          <button type="button" onClick={() => updateCategory(category)}>Запази категория</button>
          <button type="button" onClick={() => saveRouting()} >Запази пътя</button>
          <button type="button" className={styles.danger} onClick={() => deleteCategory(category)}>Изтрий</button>
        </div>)}
      </div>
    </section>
    <section className={styles.card}>
      <div className={styles.heading}><div><span>НОВА КАТЕГОРИЯ</span><h2>Добави категория</h2></div><p>След създаване я насочи към страница от списъка горе.</p></div>
      <div className={styles.row}>
        <input placeholder="Име, например Обувки" value={newName} onChange={(event) => { setNewName(event.target.value); if (!newSlug) setNewSlug(slugify(event.target.value)); }} />
        <input placeholder="slug, например obuvki" value={newSlug} onChange={(event) => setNewSlug(slugify(event.target.value))} />
        <button type="button" onClick={createCategory}>+ Създай категория</button>
      </div>
    </section>
  </div>;
}
