"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./ProductAttributesManager.module.css";

type ProductTypeValue = "CLOTHING" | "SHOES" | "ACCESSORY";
type ProductTypeAttribute = { id: string; label: string; value?: ProductTypeValue; isActive: boolean; sortOrder: number };
type SimpleAttribute = { id: string; label: string; isActive: boolean; sortOrder: number };
type Store = { productTypes: ProductTypeAttribute[]; colors: SimpleAttribute[]; materials: SimpleAttribute[]; productKinds?: Record<string, string | null> };
type AttributeKind = "productTypes" | "colors" | "materials";
type EditableAttribute = ProductTypeAttribute | SimpleAttribute;

function alphabetical<T extends { label: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.label.localeCompare(b.label, "bg-BG", { sensitivity: "base", numeric: true })
  );
}

export default function ProductAttributesManager({ initialStore }: { initialStore: Store }) {
  const [store, setStore] = useState<Store>({
    ...initialStore,
    productTypes: alphabetical(initialStore.productTypes),
    colors: alphabetical(initialStore.colors),
    materials: alphabetical(initialStore.materials),
  });
  const [message, setMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [productTypeSearch, setProductTypeSearch] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [productTypePage, setProductTypePage] = useState(1);
  const [colorPage, setColorPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const pageSize = 10;

  async function request(
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, unknown>,
    success: string,
    busyKey: string
  ) {
    if (savingKey) return false;
    setSavingKey(busyKey);
    setMessage("");
    try {
      const response = await fetch("/api/admin/product-attributes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error || "Промяната не беше запазена.");
        return false;
      }
      if (result.store) {
        setStore({
          ...result.store,
          productTypes: alphabetical(result.store.productTypes ?? []),
          colors: alphabetical(result.store.colors ?? []),
          materials: alphabetical(result.store.materials ?? []),
        });
      }
      setMessage(success);
      return true;
    } catch {
      setMessage("Връзката със сървъра прекъсна. Опитай отново.");
      return false;
    } finally {
      setSavingKey("");
    }
  }

  async function add(event: FormEvent<HTMLFormElement>, kind: AttributeKind, success: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const label = String(form.get("label") ?? "").trim();
    if (!label) {
      setMessage("Въведи име на стойността.");
      return;
    }
    const ok = await request("POST", { kind, label }, success, `add:${kind}`);
    if (ok) formElement.reset();
  }

  function startEdit(kind: AttributeKind, item: EditableAttribute) {
    setEditingKey(`${kind}:${item.id}`);
    setDraftLabel(item.label);
    setMessage("");
  }

  function cancelEdit() {
    setEditingKey("");
    setDraftLabel("");
  }

  async function saveEdit(kind: AttributeKind, item: EditableAttribute, success: string) {
    const label = draftLabel.trim();
    if (!label) {
      setMessage("Името не може да бъде празно.");
      return;
    }
    const ok = await request("PATCH", { id: item.id, kind, label }, success, `edit:${item.id}`);
    if (ok) cancelEdit();
  }

  async function toggleActive(kind: AttributeKind, item: EditableAttribute, isActive: boolean, success: string) {
    await request("PATCH", { id: item.id, kind, isActive }, success, `active:${item.id}`);
  }

  async function remove(kind: AttributeKind, item: EditableAttribute, success: string) {
    if (!confirm(`Да изтрия ли „${item.label}“?`)) return;
    const ok = await request("DELETE", { id: item.id, kind }, success, `delete:${item.id}`);
    if (ok && editingKey === `${kind}:${item.id}`) cancelEdit();
  }

  const productTypes = useMemo(() => {
    const query = productTypeSearch.trim().toLocaleLowerCase("bg-BG");
    return alphabetical(store.productTypes).filter((item) =>
      !query || item.label.toLocaleLowerCase("bg-BG").includes(query)
    );
  }, [store.productTypes, productTypeSearch]);

  const colors = useMemo(() => {
    const query = colorSearch.trim().toLocaleLowerCase("bg-BG");
    return alphabetical(store.colors).filter((item) =>
      !query || item.label.toLocaleLowerCase("bg-BG").includes(query)
    );
  }, [store.colors, colorSearch]);

  const materials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase("bg-BG");
    return alphabetical(store.materials).filter((item) =>
      !query || item.label.toLocaleLowerCase("bg-BG").includes(query)
    );
  }, [store.materials, materialSearch]);

  const productTypePages = Math.max(1, Math.ceil(productTypes.length / pageSize));
  const colorPages = Math.max(1, Math.ceil(colors.length / pageSize));
  const materialPages = Math.max(1, Math.ceil(materials.length / pageSize));

  const visibleProductTypes = productTypes.slice((Math.min(productTypePage, productTypePages) - 1) * pageSize, Math.min(productTypePage, productTypePages) * pageSize);
  const visibleColors = colors.slice((Math.min(colorPage, colorPages) - 1) * pageSize, Math.min(colorPage, colorPages) * pageSize);
  const visibleMaterials = materials.slice((Math.min(materialPage, materialPages) - 1) * pageSize, Math.min(materialPage, materialPages) * pageSize);

  return <div className={styles.wrapper}>
    {message && <div className={styles.message}>{message}</div>}

    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Типове продукти</h2>
          <p>Добавянето, коригирането и изтриването записват само конкретната стойност. Списъкът се подрежда автоматично по азбучен ред.</p>
        </div>
      </div>
      <div className={styles.filterBar}>
        <label className={styles.filterLabel}>
          <span className={styles.filterCaption}>Търси в типове</span>
          <span className={styles.searchField}>
            <input
              value={productTypeSearch}
              onChange={(event) => {
                setProductTypeSearch(event.currentTarget.value);
                setProductTypePage(1);
              }}
              placeholder="Например: тениска, обувки..."
            />
          </span>
        </label>
        {productTypeSearch && (
          <button className={styles.clearFilter} type="button" onClick={() => {
            setProductTypeSearch("");
            setProductTypePage(1);
          }}>
            Изчисти
          </button>
        )}
        <span className={styles.resultCount}>{productTypes.length} резултата</span>
      </div>
      <form className={`${styles.addRow} ${styles.productTypeRow}`} onSubmit={(event) => add(event, "productTypes", "Типът продукт е добавен.")}>
        <label className={styles.label}>Име<input name="label" maxLength={120} placeholder="Тениска, рокля, маратонки..." required /></label>
        <button className={styles.button} type="submit" disabled={Boolean(savingKey)}>+ Добави тип</button>
      </form>

      {visibleProductTypes.map((item) =>
        <AttributeRow
          key={item.id}
          kind="productTypes"
          item={item}
          editing={editingKey === `productTypes:${item.id}`}
          draftLabel={draftLabel}
          setDraftLabel={setDraftLabel}
          busy={savingKey.includes(item.id)}
          startEdit={() => startEdit("productTypes", item)}
          cancelEdit={cancelEdit}
          saveEdit={() => saveEdit("productTypes", item, "Типът продукт е коригиран.")}
          toggleActive={(active) => toggleActive("productTypes", item, active, "Статусът на типа продукт е запазен.")}
          remove={() => remove("productTypes", item, "Типът продукт е изтрит.")}
        />
      )}
      <Pagination
        page={Math.min(productTypePage, productTypePages)}
        pages={productTypePages}
        total={productTypes.length}
        pageSize={pageSize}
        onChange={setProductTypePage}
      />
    </section>

    <SimpleCard
      title="Цветове"
      description="Цветовете се избират при продукта и се използват във филтрите. Подреждат се автоматично по азбучен ред."
      kind="colors"
      items={visibleColors}
      totalItems={colors.length}
      page={Math.min(colorPage, colorPages)}
      pages={colorPages}
      pageSize={pageSize}
      onPageChange={setColorPage}
      saving={Boolean(savingKey)}
      editingKey={editingKey}
      draftLabel={draftLabel}
      setDraftLabel={setDraftLabel}
      onAdd={(event) => add(event, "colors", "Цветът е добавен.")}
      onStartEdit={(item) => startEdit("colors", item)}
      onCancelEdit={cancelEdit}
      onSaveEdit={(item) => saveEdit("colors", item, "Цветът е коригиран.")}
      onToggle={(item, active) => toggleActive("colors", item, active, "Статусът на цвета е запазен.")}
      onRemove={(item) => remove("colors", item, "Цветът е изтрит.")}
      savingKey={savingKey}
      searchValue={colorSearch}
      onSearchChange={(value) => {
        setColorSearch(value);
        setColorPage(1);
      }}
      searchPlaceholder="Например: бордо, черен..."
    />

    <SimpleCard
      title="Материали"
      description="Материалите се избират при продукта и се използват във филтрите. Подреждат се автоматично по азбучен ред."
      kind="materials"
      items={visibleMaterials}
      totalItems={materials.length}
      page={Math.min(materialPage, materialPages)}
      pages={materialPages}
      pageSize={pageSize}
      onPageChange={setMaterialPage}
      saving={Boolean(savingKey)}
      editingKey={editingKey}
      draftLabel={draftLabel}
      setDraftLabel={setDraftLabel}
      onAdd={(event) => add(event, "materials", "Материалът е добавен.")}
      onStartEdit={(item) => startEdit("materials", item)}
      onCancelEdit={cancelEdit}
      onSaveEdit={(item) => saveEdit("materials", item, "Материалът е коригиран.")}
      onToggle={(item, active) => toggleActive("materials", item, active, "Статусът на материала е запазен.")}
      onRemove={(item) => remove("materials", item, "Материалът е изтрит.")}
      savingKey={savingKey}
      searchValue={materialSearch}
      onSearchChange={(value) => {
        setMaterialSearch(value);
        setMaterialPage(1);
      }}
      searchPlaceholder="Например: памук, кожа..."
    />
  </div>;
}

function AttributeRow({
  kind, item, editing, draftLabel, setDraftLabel, busy,
  startEdit, cancelEdit, saveEdit, toggleActive, remove,
}: {
  kind: AttributeKind;
  item: EditableAttribute;
  editing: boolean;
  draftLabel: string;
  setDraftLabel: (value: string) => void;
  busy: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  toggleActive: (active: boolean) => void;
  remove: () => void;
}) {
  const rowClass = kind === "productTypes" ? styles.productTypeRow : styles.simpleRow;
  return <div className={`${styles.row} ${rowClass}`}>
    <label className={styles.label}>
      Име
      <input
        value={editing ? draftLabel : item.label}
        readOnly={!editing}
        maxLength={120}
        className={!editing ? styles.readOnlyInput : undefined}
        onChange={(event) => editing && setDraftLabel(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (!editing) return;
          if (event.key === "Enter") { event.preventDefault(); saveEdit(); }
          if (event.key === "Escape") { event.preventDefault(); cancelEdit(); }
        }}
      />
    </label>
    <label className={styles.label}>
      Активен
      <select value={item.isActive ? "1" : "0"} disabled={busy} onChange={(event) => toggleActive(event.currentTarget.value === "1")}>
        <option value="1">Да</option><option value="0">Не</option>
      </select>
    </label>
    <div className={styles.actions}>
      {!editing ? <>
        <button className={styles.secondary} type="button" onClick={startEdit} disabled={busy}>Коригирай</button>
        <button className={styles.danger} type="button" onClick={remove} disabled={busy}>Изтрий</button>
      </> : <>
        <button className={styles.button} type="button" onClick={saveEdit} disabled={busy}>Запази</button>
        <button className={styles.secondary} type="button" onClick={cancelEdit} disabled={busy}>Отказ</button>
      </>}
    </div>
  </div>;
}

function SimpleCard({
  title, description, kind, items, totalItems, page, pages, pageSize, onPageChange,
  saving, editingKey, draftLabel, setDraftLabel,
  onAdd, onStartEdit, onCancelEdit, onSaveEdit, onToggle, onRemove, savingKey,
  searchValue, onSearchChange, searchPlaceholder,
}: {
  title: string;
  description: string;
  kind: "colors" | "materials";
  items: SimpleAttribute[];
  totalItems: number;
  page: number;
  pages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  saving: boolean;
  editingKey: string;
  draftLabel: string;
  setDraftLabel: (value: string) => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onStartEdit: (item: SimpleAttribute) => void;
  onCancelEdit: () => void;
  onSaveEdit: (item: SimpleAttribute) => void;
  onToggle: (item: SimpleAttribute, active: boolean) => void;
  onRemove: (item: SimpleAttribute) => void;
  savingKey: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
}) {
  return <section className={styles.card}>
    <div className={styles.cardHeader}><div><h2>{title}</h2><p>{description}</p></div></div>
    <div className={styles.filterBar}>
      <label className={styles.filterLabel}>
        <span className={styles.filterCaption}>Търси в {title.toLocaleLowerCase("bg-BG")}</span>
        <span className={styles.searchField}>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder={searchPlaceholder}
          />
        </span>
      </label>
      {searchValue && (
        <button className={styles.clearFilter} type="button" onClick={() => onSearchChange("")}>
          Изчисти
        </button>
      )}
      <span className={styles.resultCount}>{totalItems} резултата</span>
    </div>
    <form className={`${styles.addRow} ${styles.simpleRow}`} onSubmit={onAdd}>
      <label className={styles.label}>Име<input name="label" maxLength={120} placeholder={title === "Цветове" ? "Бордо, черен, бял..." : "Памук, кожа, вълна..."} required /></label>
      <span />
      <button className={styles.button} type="submit" disabled={saving}>+ Добави</button>
    </form>
    {items.length === 0 && <div className={styles.empty}>Няма стойности.</div>}
    {items.map((item) =>
      <AttributeRow
        key={item.id}
        kind={kind}
        item={item}
        editing={editingKey === `${kind}:${item.id}`}
        draftLabel={draftLabel}
        setDraftLabel={setDraftLabel}
        busy={savingKey.includes(item.id)}
        startEdit={() => onStartEdit(item)}
        cancelEdit={onCancelEdit}
        saveEdit={() => onSaveEdit(item)}
        toggleActive={(active) => onToggle(item, active)}
        remove={() => onRemove(item)}
      />
    )}
    <Pagination
      page={page}
      pages={pages}
      total={totalItems}
      pageSize={pageSize}
      onChange={onPageChange}
    />
  </section>;
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
    <nav className={styles.pagination} aria-label="Страници">
      <div className={styles.paginationInfo}>
        Показани {first}–{last} от {total}
      </div>
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
