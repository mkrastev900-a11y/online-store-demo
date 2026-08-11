/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProductForm.module.css";
import ProductImageManager from "./ProductImageManager";
import ManualProductSizeGuideEditor, { createEmptyManualGuide, type ManualSizeGuide } from "./ManualProductSizeGuideEditor";
import MaterialCompositionEditor, { type MaterialCompositionItem } from "./MaterialCompositionEditor";

type CatalogSection = { id: number; name: string; slug: string; baseAudience: "WOMEN" | "MEN" | "KIDS"; isActive?: boolean };
type Category = { id: number; name: string; slug: string; sectionId?: number | null };
type Variant = { size: string; stock: number };
type Product = {
  id: number;
  name: string;
  description: string;
  material: string | null;
  materialComposition?: MaterialCompositionItem[] | null;
  color: string | null;
  brand: string | null;
  sectionId?: number | null;
  categoryId: number;
  audience: "WOMEN" | "MEN" | "KIDS";
  productType: "CLOTHING" | "SHOES" | "ACCESSORY";
  productKind?: string | null;
  price: number;
  compareAtPrice: number | null;
  isNew: boolean;
  isFeatured: boolean;
  isActive: boolean;
  images: Array<{ id: number; url: string }>;
  variants: Array<{ id: number; size: string; stock: number }>;
  sizeGuideId?: number | null;
  hasCustomSizing?: boolean;
  customSizeGuide?: ManualSizeGuide | null;
};

type ProductAttributeOption = { id: string; label: string; value?: "CLOTHING" | "SHOES" | "ACCESSORY"; isActive: boolean; sortOrder: number };
type ProductAttributes = { productTypes: ProductAttributeOption[]; colors: ProductAttributeOption[]; materials: ProductAttributeOption[] };
const fallbackAttributes: ProductAttributes = {
  productTypes: [
    { id: "clothing", label: "Дреха", value: "CLOTHING", isActive: true, sortOrder: 10 },
    { id: "shoes", label: "Обувки", value: "SHOES", isActive: true, sortOrder: 20 },
    { id: "accessory", label: "Аксесоар", value: "ACCESSORY", isActive: true, sortOrder: 30 },
  ],
  colors: [],
  materials: [],
};
function activeOptions(items: ProductAttributeOption[] | undefined) {
  return (items ?? []).filter((item) => item.isActive !== false).sort((a,b)=>a.sortOrder-b.sortOrder || a.label.localeCompare(b.label,"bg"));
}
type SizeGuide = { id:number; name:string; sizes:Array<{label:string;isActive:boolean}> };


export default function EditProductForm({
  categories,
  sections,
  product,
  attributes = fallbackAttributes,
}: {
  categories: Category[];
  sections?: CatalogSection[];
  product: Product;
  attributes?: ProductAttributes;
}) {
  const router = useRouter();
  const safeSections = sections ?? [];
  const productTypeOptions = activeOptions(attributes.productTypes);
  const colorOptions = activeOptions(attributes.colors);
  const materialOptions = activeOptions(attributes.materials);
  const selectedTypeOption = productTypeOptions.find((item) => item.label === product.productKind) ?? productTypeOptions.find((item) => item.value === product.productType) ?? productTypeOptions[0];
  const [productType, setProductType] = useState<Product["productType"]>(selectedTypeOption?.value ?? product.productType);
  const [productKind, setProductKind] = useState(selectedTypeOption?.label ?? product.productKind ?? "Дреха");
  const initialSectionId = product.sectionId
    ?? categories.find((category) => category.id === product.categoryId)?.sectionId
    ?? safeSections.find((section) => section.baseAudience === product.audience)?.id
    ?? null;
  // При редакция никога не избираме първата секция по подразбиране.
  // Зареждаме реалната записана секция, а за стари продукти без sectionId
  // възстановяваме секцията от категорията или аудиторията на продукта.
  const [sectionId, setSectionId] = useState(initialSectionId ? String(initialSectionId) : "");
  const [variants, setVariants] = useState<Variant[]>(
    product.variants.map((v) => ({ size: v.size, stock: v.stock })),
  );
  const [imageUrls, setImageUrls] = useState(product.images.map((i) => i.url));
  const [saving, setSaving] = useState(false);
  const [sizeGuides, setSizeGuides] = useState<SizeGuide[]>([]);
  const [sizeGuideId, setSizeGuideId] = useState(product.sizeGuideId ? String(product.sizeGuideId) : "");
  const [sizeMode, setSizeMode] = useState<"STANDARD" | "CUSTOM">(product.hasCustomSizing ? "CUSTOM" : "STANDARD");
  const [customSizeGuide, setCustomSizeGuide] = useState<ManualSizeGuide>(product.customSizeGuide ?? createEmptyManualGuide());
  const [error, setError] = useState("");
  const [materialComposition, setMaterialComposition] = useState<MaterialCompositionItem[]>(
    Array.isArray(product.materialComposition) && product.materialComposition.length
      ? product.materialComposition
      : product.material
        ? [{ material: product.material, percentage: 100 }]
        : [{ material: "", percentage: 100 }],
  );

  useEffect(() => { fetch("/api/admin/size-guides", { cache: "no-store" }).then(r => r.ok ? r.json() : { guides: [] }).then(d => setSizeGuides(d.guides ?? [])).catch(() => setSizeGuides([])); }, []);


  useEffect(() => {
    if (sizeMode !== "CUSTOM") return;
    const customSizes = customSizeGuide.sizes
      .map((row) => row.label.trim())
      .filter(Boolean);

    setVariants((current) => {
      const next = customSizes.map((size) => ({
        size,
        stock: current.find((variant) => variant.size === size)?.stock ?? 0,
      }));

      if (next.length === current.length && next.every((item, index) => item.size === current[index]?.size && item.stock === current[index]?.stock)) {
        return current;
      }

      return next;
    });
  }, [sizeMode, customSizeGuide.sizes]);


  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (sizeMode === "STANDARD" && !sizeGuideId) {
      setError("Избери създадена размерна таблица или използвай индивидуални мерки за този модел.");
      setSaving(false);
      return;
    }

    const validMaterials = materialComposition.filter((item) => item.material.trim() && item.percentage > 0);
    const materialTotal = validMaterials.reduce((sum, item) => sum + item.percentage, 0);
    if (!validMaterials.length || materialTotal !== 100) {
      setError("Избери материалите и въведи общ състав точно 100%.");
      setSaving(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
        materialComposition: validMaterials,
        color: formData.get("color"),
        brand: formData.get("brand"),
        sectionId,
        categoryId: formData.get("categoryId"),
        audience: safeSections.find((section) => String(section.id) === sectionId)?.baseAudience ?? product.audience,
        productType,
        productKind,
        sizeGuideId: sizeMode === "STANDARD" ? sizeGuideId : "",
        hasCustomSizing: sizeMode === "CUSTOM",
        customSizeGuide: sizeMode === "CUSTOM" ? customSizeGuide : null,
        price: formData.get("price"),
        compareAtPrice: formData.get("compareAtPrice"),
        imageUrls,
        variants,
        isNew: formData.get("isNew") === "on",
        isFeatured: formData.get("isFeatured") === "on",
        isActive: formData.get("isActive") === "on",
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Промените не бяха запазени.");
      setSaving(false);
      return;
    }

    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.section}>
        <h2>Основна информация</h2>
        <div className={styles.gridTwo}>
          <label>Име<input name="name" defaultValue={product.name} required /></label>
          <label>Марка<input name="brand" defaultValue={product.brand ?? ""} /></label>
          <label>
            Секция / страница
            <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} required>
              <option value="">Избери секция</option>
              {safeSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name} · /{section.slug}{section.isActive === false ? " (неактивна)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Категория / филтър
            <select name="categoryId" defaultValue={product.categoryId} required>
              <option value="">Избери категория</option>
              {categories.filter((category) => !sectionId || category.sectionId == null || String(category.sectionId) === sectionId).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Тип продукт
            <select value={productKind} onChange={(e) => { const option = productTypeOptions.find((item) => item.label === e.target.value); setProductKind(e.target.value); setProductType((option?.value ?? "CLOTHING") as Product["productType"]); }}>
              {productTypeOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
            </select>
          </label>
          <label>Цвят<select name="color" defaultValue={product.color ?? ""}><option value="">Избери цвят</option>{colorOptions.map((option)=><option key={option.id} value={option.label}>{option.label}</option>)}{product.color && !colorOptions.some((option)=>option.label===product.color) ? <option value={product.color}>{product.color}</option> : null}</select></label>
          <MaterialCompositionEditor options={materialOptions} value={materialComposition} onChange={setMaterialComposition} />
        </div>
        <label>Описание<textarea name="description" rows={7} required defaultValue={product.description} /></label>
      </section>

      <section className={styles.section}>
        <h2>Цена и показване</h2>
        <div className={styles.gridTwo}>
          <label>Цена<input name="price" type="number" min="0" step="0.01" required defaultValue={product.price} /></label>
          <label>Стара цена<input name="compareAtPrice" type="number" min="0" step="0.01" defaultValue={product.compareAtPrice ?? ""} /></label>
        </div>
        <div className={styles.checks}>
          <label><input name="isNew" type="checkbox" defaultChecked={product.isNew} /> Нов</label>
          <label><input name="isFeatured" type="checkbox" defaultChecked={product.isFeatured} /> Препоръчан</label>
          <label><input name="isActive" type="checkbox" defaultChecked={product.isActive} /> Активен</label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Снимки</h2>
        <ProductImageManager imageUrls={imageUrls} setImageUrls={setImageUrls} onError={setError} />
      </section>

      <section className={styles.section}>
        <h2>Размери и наличности</h2>
        <div className={styles.sizeMode}>
          <strong>Начин на задаване</strong>
          <div className={styles.sizeModeOptions}>
            <button type="button" className={`${styles.sizeModeButton} ${sizeMode === "STANDARD" ? styles.sizeModeActive : ""}`} onClick={()=>setSizeMode("STANDARD")}><strong>Готов европейски стандарт</strong><span>Използвай многократна размерна таблица от Админ → Размери.</span></button>
            <button type="button" className={`${styles.sizeModeButton} ${sizeMode === "CUSTOM" ? styles.sizeModeActive : ""}`} onClick={()=>setSizeMode("CUSTOM")}><strong>Индивидуални мерки за този модел</strong><span>Размерите може пак да са S, M, L или EU 38, но параметрите важат само за този артикул.</span></button>
          </div>
        </div>

        {sizeMode === "STANDARD" ? <>
          <label className={styles.guideSelect}>Европейска размерна таблица
            <select value={sizeGuideId} onChange={(event) => {
              const id = event.target.value; setSizeGuideId(id);
              const guide = sizeGuides.find((item) => String(item.id) === id);
              if (guide && confirm("Да заредя размерите от таблицата? Текущият списък ще бъде заменен.")) setVariants(guide.sizes.filter((size) => size.isActive).map((size) => ({ size: size.label, stock: 0 })));
            }}>
              <option value="">Избери създадена размерна таблица</option>
              {sizeGuides.map((guide) => <option key={guide.id} value={guide.id}>{guide.name}</option>)}
            </select>
          </label>
          {sizeGuides.length === 0 && <div className={styles.error}>Няма създадени размерни таблици. Създай таблица от Админ → Магазин → Размери или избери „Индивидуални мерки за този модел“.</div>}
        </> : <>
          <ManualProductSizeGuideEditor value={customSizeGuide} onChange={setCustomSizeGuide} />
        </>}

        <div className={styles.stockHeading}>
          <h3>Бройки по размер</h3>
          <p>{sizeMode === "CUSTOM" ? "Бройките се появяват автоматично за всеки размер от индивидуалната таблица." : "Задай наличност за всеки размер от избраната стандартна таблица."}</p>
        </div>
        <div className={styles.variantList}>
          {variants.map((variant,index)=><div key={`${variant.size}-${index}`} className={styles.variantRowSimple}><label>Размер<input value={variant.size} readOnly={sizeMode === "STANDARD"} onChange={e=>setVariants(c=>c.map((v,i)=>i===index?{...v,size:e.target.value}:v))}/></label><label>Бройки в склада<input type="number" min="0" step="1" value={variant.stock} onChange={e=>setVariants(c=>c.map((v,i)=>i===index?{...v,stock:Math.max(0,Number(e.target.value))}:v))}/></label>{sizeMode === "CUSTOM" && <span className={styles.stockHint}>идва от индивидуалния размер</span>}</div>)}
        </div>
        {variants.length === 0 && <div className={styles.error}>{sizeMode === "CUSTOM" ? "Добави поне един размер в индивидуалната таблица, за да зададеш бройки." : "Избери размерна таблица, за да зададеш бройки."}</div>}
        <div className={styles.totalStock}>Общо налични: <strong>{variants.reduce((sum,v)=>sum+v.stock,0)} бр.</strong></div>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.submit} disabled={saving}>
        {saving ? "Запазване..." : "Запази промените"}
      </button>
    </form>
  );
}
