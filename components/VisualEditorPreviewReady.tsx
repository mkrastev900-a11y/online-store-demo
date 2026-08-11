"use client";

import { useEffect } from "react";

/**
 * Prepares the real storefront for use inside the visual editor iframe.
 * The preview must behave like an independent browser viewport: the page
 * scrolls inside the frame, while the editor toolbar and inspector stay fixed.
 */
export default function VisualEditorPreviewReady() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("visualEditorPreview") !== "1") return;

    document.documentElement.dataset.visualEditorHydrated = "true";
    document.documentElement.dataset.visualEditorPreview = "true";

    const style = document.createElement("style");
    style.id = "zlatevi-visual-editor-scroll-fix";
    style.textContent = `
      html[data-visual-editor-preview="true"],
      html[data-visual-editor-preview="true"] body {
        width: 100% !important;
        height: auto !important;
        min-height: 100% !important;
        max-height: none !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        scroll-behavior: auto !important;
      }

      html[data-visual-editor-preview="true"] body {
        position: static !important;
        inset: auto !important;
      }

      html[data-visual-editor-preview="true"] body > * {
        max-height: none !important;
      }

      html[data-visual-editor-preview="true"] [data-storefront-root] {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        min-height: 100vh !important;
        max-height: none !important;
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);

    // Some browser/transform combinations do not forward the mouse wheel to a
    // scaled iframe reliably. Handling it in the preview document guarantees
    // that the storefront itself scrolls from top to footer.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      const target = event.target as Element | null;
      const nestedScroller = target?.closest<HTMLElement>(
        "[data-allow-inner-scroll], textarea, select, [role='listbox']",
      );
      if (nestedScroller && nestedScroller.scrollHeight > nestedScroller.clientHeight) return;

      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (maxScroll <= 0) return;
      const next = Math.max(0, Math.min(maxScroll, window.scrollY + event.deltaY));
      if (next === window.scrollY) return;
      event.preventDefault();
      window.scrollTo({ top: next, behavior: "auto" });
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });


    const applySnapshotPreview = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "zlatevi:theme-snapshot-preview") return;
      const snapshot = event.data.snapshot;
      if (!snapshot || typeof snapshot !== "object") return;
      const root = document.documentElement;
      const get = (key: string) => String(snapshot[key] ?? "").trim();
      const primary = get("primaryColor");
      const secondary = get("secondaryColor");
      const bg = get("lightBackground");
      const surface = get("lightSurface");
      const text = get("lightText");
      if (primary) {
        root.style.setProperty("--brand-primary", primary, "important");
        root.style.setProperty("--theme-primary", primary, "important");
        root.style.setProperty("--wine-800", primary, "important");
      }
      if (secondary) {
        root.style.setProperty("--brand-secondary", secondary, "important");
        root.style.setProperty("--theme-accent", secondary, "important");
        root.style.setProperty("--gold-500", secondary, "important");
      }
      if (bg) {
        root.style.setProperty("--theme-bg", bg, "important");
        root.style.setProperty("--cream", bg, "important");
        document.body.style.setProperty("background-color", bg, "important");
      }
      if (surface) {
        root.style.setProperty("--theme-surface", surface, "important");
        root.style.setProperty("--paper", surface, "important");
      }
      if (text) {
        root.style.setProperty("--theme-text", text, "important");
        root.style.setProperty("--ink", text, "important");
        document.body.style.setProperty("color", text, "important");
      }
    };

    window.addEventListener("message", applySnapshotPreview);

    window.parent.postMessage(
      {
        type: "zlatevi:visual-editor-preview-ready",
        pathname: window.location.pathname,
        device: params.get("device") || "desktop",
        viewport: params.get("viewport") || "",
      },
      window.location.origin,
    );

    return () => {
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("message", applySnapshotPreview);
      style.remove();
      delete document.documentElement.dataset.visualEditorHydrated;
      delete document.documentElement.dataset.visualEditorPreview;
    };
  }, []);

  return null;
}
