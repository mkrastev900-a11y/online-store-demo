/* eslint-disable react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "@/app/page.module.css";

type Props = {
  images: string[];
  variantClass?: string;
  eyebrow: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
};

function cleanImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default function HeroSlideshow({
  images,
  variantClass = "",
  eyebrow,
  title,
  description,
  buttonText,
  buttonHref,
}: Props) {
  const initialImages = useMemo(() => cleanImages(images), [images]);
  const [previewImages, setPreviewImages] = useState(initialImages);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setPreviewImages(initialImages);
    setActive(0);
  }, [initialImages]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "zlatevi:hero-images-preview") return;
      const next = cleanImages(event.data.images);
      if (!next.length) return;
      setPreviewImages(next);
      setActive(0);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (previewImages.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % previewImages.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [previewImages.length]);

  const safeIndex = previewImages.length ? active % previewImages.length : 0;
  const currentImage = previewImages[safeIndex] || "";
  const move = (direction: number) => {
    if (previewImages.length < 2) return;
    setActive((current) => (current + direction + previewImages.length) % previewImages.length);
  };

  return (
    <section
      className={`${styles.hero} ${variantClass}`}
      style={{ "--hero-image": `url("${currentImage.replaceAll('"', "")}")` } as CSSProperties}
    >
      <div className={styles.heroShade} />
      {previewImages.length > 1 && (
        <button type="button" className={`${styles.sliderArrow} ${styles.leftArrow}`} aria-label="Предишен слайд" onClick={() => move(-1)}>‹</button>
      )}
      <div className={styles.heroContent}>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {buttonText.trim() && <Link href={buttonHref || "/new"}><span>{buttonText.trim()}</span><b aria-hidden="true">→</b></Link>}
      </div>
      {previewImages.length > 1 && (
        <button type="button" className={`${styles.sliderArrow} ${styles.rightArrow}`} aria-label="Следващ слайд" onClick={() => move(1)}>›</button>
      )}
      {previewImages.length > 1 && (
        <div className={styles.dots} aria-label="Слайдове">
          {previewImages.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              className={index === safeIndex ? styles.activeDot : ""}
              onClick={() => setActive(index)}
              aria-label={`Покажи снимка ${index + 1}`}
              aria-current={index === safeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
