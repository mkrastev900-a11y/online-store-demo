"use client";

import styles from "./ProductForm.module.css";

export type MaterialCompositionItem = { material: string; percentage: number };

type Option = { id: string; label: string };

export default function MaterialCompositionEditor({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: MaterialCompositionItem[];
  onChange: (next: MaterialCompositionItem[]) => void;
}) {
  const total = value.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);

  function update(index: number, patch: Partial<MaterialCompositionItem>) {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function add() {
    const used = new Set(value.map((item) => item.material));
    const nextMaterial = options.find((option) => !used.has(option.label))?.label ?? "";
    onChange([...value, { material: nextMaterial, percentage: 0 }]);
  }

  function remove(index: number) {
    const next = value.filter((_, itemIndex) => itemIndex !== index);
    onChange(next.length ? next : [{ material: "", percentage: 100 }]);
  }

  return (
    <div className={styles.materialComposition}>
      <div className={styles.materialHeader}>
        <span>Материали и състав</span>
        <strong className={total === 100 ? styles.materialTotalOk : styles.materialTotalError}>Общо: {total}%</strong>
      </div>

      <div className={styles.materialRows}>
        {value.map((item, index) => (
          <div className={styles.materialRow} key={`${index}-${item.material}`}>
            <select
              aria-label={`Материал ${index + 1}`}
              value={item.material}
              onChange={(event) => update(index, { material: event.target.value })}
            >
              <option value="">Избери материал</option>
              {options.map((option) => (
                <option key={option.id} value={option.label} disabled={value.some((current, currentIndex) => currentIndex !== index && current.material === option.label)}>
                  {option.label}
                </option>
              ))}
              {item.material && !options.some((option) => option.label === item.material) ? <option value={item.material}>{item.material}</option> : null}
            </select>

            <div className={styles.percentageWrap}>
              <input
                aria-label={`Процент ${index + 1}`}
                type="number"
                min="0"
                max="100"
                step="1"
                value={item.percentage}
                onChange={(event) => update(index, { percentage: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
              />
              <span>%</span>
            </div>

            <button type="button" className={styles.materialRemove} onClick={() => remove(index)} aria-label="Премахни материал">×</button>
          </div>
        ))}
      </div>

      <button type="button" className={styles.materialAdd} onClick={add}>+ Добави материал</button>
      {total !== 100 ? <small className={styles.materialWarning}>Общият състав трябва да бъде точно 100%.</small> : null}
    </div>
  );
}
