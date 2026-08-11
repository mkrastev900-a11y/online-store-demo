"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import styles from "./ProductForm.module.css";

type Props = {
  imageUrls: string[];
  setImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
  onError: (message: string) => void;
};

const MAX_IMAGES = 10;

export default function ProductImageManager({ imageUrls, setImageUrls, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  async function upload(files: File[]) {
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) return onError(`Максимум ${MAX_IMAGES} снимки на продукт.`);
    const selected = files.slice(0, remaining);
    if (!selected.length) return;

    setUploading(true);
    onError("");
    try {
      const data = new FormData();
      selected.forEach((file) => data.append("files", file));
      const response = await fetch("/api/admin/upload", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Грешка при качване.");
      setImageUrls((current) => [...current, ...result.images.map((image: { url: string }) => image.url)].slice(0, MAX_IMAGES));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Грешка при качване.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImageUrls((current) => current.filter((_, i) => i !== index));
  }

  function move(from: number, to: number) {
    if (from === to) return;
    setImageUrls((current) => {
      const copy = [...current];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  return (
    <div>
      <div
        className={styles.dropzone}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          className={styles.hiddenFileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            void upload(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          disabled={uploading}
        />
        <strong>{uploading ? "Качване в Cloudinary..." : "Пусни снимките тук или натисни за избор"}</strong>
        <span>JPG, PNG или WEBP · до 8 MB · максимум {MAX_IMAGES} снимки</span>
      </div>

      <div className={styles.imageGrid}>
        {imageUrls.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className={styles.imageCard}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging !== null) move(dragging, index);
              setDragging(null);
            }}
          >
            <Image src={url} alt={`Снимка ${index + 1}`} width={480} height={600} />
            <span>{index === 0 ? "★ Основна снимка" : `Снимка ${index + 1}`}</span>
            <div className={styles.imageActions}>
              {index > 0 && <button type="button" onClick={() => move(index, 0)}>Направи основна</button>}
              <button type="button" onClick={() => removeImage(index)}>Премахни</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
