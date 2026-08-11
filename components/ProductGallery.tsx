"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styles from "./ProductGallery.module.css";

type GalleryImage = {
  url: string;
  alt: string;
};

type Props = {
  images: GalleryImage[];
  productName: string;
  isNew?: boolean;
};

type Point = { x: number; y: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export default function ProductGallery({ images, productName, isNew = false }: Props) {
  const safeImages = useMemo(
    () => images.filter((image, index, all) => image.url && all.findIndex((item) => item.url === image.url) === index),
    [images],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const dragOrigin = useRef<{ pointer: Point; pan: Point } | null>(null);
  const pinchOrigin = useRef<{ distance: number; zoom: number; midpoint: Point; pan: Point } | null>(null);

  const active = safeImages[activeIndex] ?? safeImages[0];

  const clampPan = useCallback((next: Point, nextZoom = zoom): Point => {
    const viewport = viewportRef.current;
    if (!viewport || nextZoom <= MIN_ZOOM) return { x: 0, y: 0 };
    const bounds = viewport.getBoundingClientRect();
    const maxX = Math.max(0, (bounds.width * (nextZoom - 1)) / 2);
    const maxY = Math.max(0, (bounds.height * (nextZoom - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, [zoom]);

  const resetView = useCallback(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    pointers.current.clear();
    dragOrigin.current = null;
    pinchOrigin.current = null;
  }, []);

  const applyZoom = useCallback((nextZoom: number, anchor?: Point) => {
    const normalized = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(nextZoom.toFixed(2))));
    setZoom((currentZoom) => {
      if (normalized === currentZoom) return currentZoom;
      if (normalized <= MIN_ZOOM) {
        setPan({ x: 0, y: 0 });
        return normalized;
      }
      setPan((currentPan) => {
        if (!anchor || !viewportRef.current) return clampPan(currentPan, normalized);
        const rect = viewportRef.current.getBoundingClientRect();
        const cursor = { x: anchor.x - rect.left - rect.width / 2, y: anchor.y - rect.top - rect.height / 2 };
        const ratio = normalized / currentZoom;
        return clampPan({
          x: cursor.x - (cursor.x - currentPan.x) * ratio,
          y: cursor.y - (cursor.y - currentPan.y) * ratio,
        }, normalized);
      });
      return normalized;
    });
  }, [clampPan]);

  const previous = useCallback(() => {
    if (safeImages.length < 2) return;
    setActiveIndex((current) => (current - 1 + safeImages.length) % safeImages.length);
    resetView();
  }, [safeImages.length, resetView]);

  const next = useCallback(() => {
    if (safeImages.length < 2) return;
    setActiveIndex((current) => (current + 1) % safeImages.length);
    resetView();
  }, [safeImages.length, resetView]);

  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
    resetView();
  }, [resetView]);

  function handleTouchEnd(clientX: number) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45 || zoom > MIN_ZOOM) return;
    if (distance > 0) previous();
    else next();
  }

  function pointerMidpoint(values: Point[]) {
    return { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
  }

  function pointerDistance(values: Point[]) {
    return Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= MIN_ZOOM && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...pointers.current.values()];
    if (values.length === 1) {
      dragOrigin.current = { pointer: values[0], pan };
      setDragging(zoom > MIN_ZOOM);
    } else if (values.length === 2) {
      pinchOrigin.current = {
        distance: Math.max(1, pointerDistance(values)),
        zoom,
        midpoint: pointerMidpoint(values),
        pan,
      };
      dragOrigin.current = null;
      setDragging(true);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...pointers.current.values()];
    if (values.length === 2 && pinchOrigin.current) {
      const origin = pinchOrigin.current;
      const midpoint = pointerMidpoint(values);
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, origin.zoom * (pointerDistance(values) / origin.distance)));
      setZoom(nextZoom);
      setPan(clampPan({
        x: origin.pan.x + (midpoint.x - origin.midpoint.x),
        y: origin.pan.y + (midpoint.y - origin.midpoint.y),
      }, nextZoom));
      return;
    }
    if (values.length === 1 && dragOrigin.current && zoom > MIN_ZOOM) {
      const current = values[0];
      setPan(clampPan({
        x: dragOrigin.current.pan.x + current.x - dragOrigin.current.pointer.x,
        y: dragOrigin.current.pan.y + current.y - dragOrigin.current.pointer.y,
      }));
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      dragOrigin.current = { pointer: remaining, pan };
      pinchOrigin.current = null;
    } else if (pointers.current.size === 0) {
      dragOrigin.current = null;
      pinchOrigin.current = null;
      setDragging(false);
    }
  }

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFullscreen();
      if (event.key === "ArrowLeft" && zoom === MIN_ZOOM) previous();
      if (event.key === "ArrowRight" && zoom === MIN_ZOOM) next();
      if (event.key === "+" || event.key === "=") applyZoom(zoom + ZOOM_STEP);
      if (event.key === "-") applyZoom(zoom - ZOOM_STEP);
      if (event.key === "0") resetView();
      if (zoom > MIN_ZOOM && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 80 : 30;
        setPan((current) => clampPan({
          x: current.x + (event.key === "ArrowLeft" ? amount : event.key === "ArrowRight" ? -amount : 0),
          y: current.y + (event.key === "ArrowUp" ? amount : event.key === "ArrowDown" ? -amount : 0),
        }));
      }
    };
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen, zoom, applyZoom, clampPan, closeFullscreen, next, previous, resetView]);

  useEffect(() => {
    if (!fullscreen) return;
    const onResize = () => setPan((current) => clampPan(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fullscreen, clampPan]);

  if (!active) return null;

  const lightbox = fullscreen && mounted ? createPortal(
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Галерия на продукта" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFullscreen(); }}>
      <button type="button" className={styles.close} onClick={closeFullscreen} aria-label="Затвори галерията" title="Затвори"><span aria-hidden="true">×</span></button>
      <div className={styles.lightboxShell}>
        <div
          ref={viewportRef}
          className={`${styles.lightboxImage} ${zoom > MIN_ZOOM ? styles.zoomed : ""} ${dragging ? styles.dragging : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => {
            event.preventDefault();
            applyZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25), { x: event.clientX, y: event.clientY });
          }}
          onDoubleClick={(event) => applyZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM, { x: event.clientX, y: event.clientY })}
        >
          <div className={styles.zoomCanvas} style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}>
            <Image src={active.url} alt={active.alt || productName} fill sizes="100vw" className={styles.containImage} priority draggable={false} />
          </div>
          {zoom > MIN_ZOOM && !dragging ? <span className={styles.panHint}>Хвани и премести снимката</span> : null}
        </div>
        <div className={styles.zoomControls} aria-label="Увеличение на снимката">
          <button type="button" onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Намали">−</button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button type="button" onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Увеличи">+</button>
          {zoom > MIN_ZOOM ? <button type="button" className={styles.resetZoom} onClick={resetView} aria-label="Нулирай увеличението">100%</button> : null}
        </div>
        {safeImages.length > 1 && <div className={styles.lightboxThumbnails} aria-label="Снимки на продукта">{safeImages.map((image, index) => <button type="button" key={image.url} className={`${styles.lightboxThumbnail} ${index === activeIndex ? styles.lightboxThumbnailActive : ""}`} onClick={() => { setActiveIndex(index); resetView(); }} aria-label={`Покажи снимка ${index + 1}`} aria-current={index === activeIndex}><Image src={image.url} alt={image.alt || `${productName} — снимка ${index + 1}`} fill sizes="84px" /></button>)}</div>}
      </div>
      {safeImages.length > 1 && <><button type="button" className={`${styles.lightboxArrow} ${styles.left}`} onClick={previous} aria-label="Предишна снимка">‹</button><button type="button" className={`${styles.lightboxArrow} ${styles.right}`} onClick={next} aria-label="Следваща снимка">›</button><span className={styles.lightboxCounter}>{activeIndex + 1} / {safeImages.length}</span></>}
    </div>,
    document.body,
  ) : null;

  return <div className={styles.gallery}>
    <div className={styles.stageWrap}>
      <button type="button" className={styles.stage} onClick={() => { resetView(); setFullscreen(true); }} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)} aria-label="Отвори снимката на цял екран">
        <Image src={active.url} alt={active.alt || productName} fill priority sizes="(max-width: 920px) 100vw, 62vw" className={styles.mainImage} />
        {isNew && <span className={styles.newBadge}>Нова селекция</span>}
        <span className={styles.zoomHint}>Увеличи</span>
      </button>
      {safeImages.length > 1 && <><button type="button" className={`${styles.arrow} ${styles.left}`} onClick={previous} aria-label="Предишна снимка">‹</button><button type="button" className={`${styles.arrow} ${styles.right}`} onClick={next} aria-label="Следваща снимка">›</button><span className={styles.counter}>{activeIndex + 1} / {safeImages.length}</span></>}
    </div>
    {safeImages.length > 1 && <div className={styles.thumbnails} aria-label="Снимки на продукта">{safeImages.map((image, index) => <button type="button" key={image.url} className={`${styles.thumbnail} ${index === activeIndex ? styles.activeThumbnail : ""}`} onClick={() => setActiveIndex(index)} aria-label={`Покажи снимка ${index + 1}`} aria-current={index === activeIndex}><Image src={image.url} alt={image.alt || `${productName} — снимка ${index + 1}`} fill sizes="92px" /></button>)}</div>}
    {lightbox}
  </div>;
}
