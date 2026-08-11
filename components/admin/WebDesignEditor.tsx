/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { getContactContentValue, getPrimaryContactPhone, parseCustomHomeSections, parseDesignTokenOverrides, serializeDesignTokenOverrides, withContactContentValue, withPrimaryContactPhone, type ContactContentKey, type SiteDesign } from "@/lib/site-design";
import { deriveHeaderPalette } from "@/lib/design-engine/header-palette";
import {
  DEFAULT_PAGE_CONTENT,
  parsePageContent,
  type EditablePageContent,
  type EditablePageKey,
} from "@/lib/page-content";
import styles from "./WebDesignEditor.module.css";
import PageLinkField, { STORE_PAGE_LINK_OPTIONS, type PageLinkOption } from "./PageLinkField";

type DesignVersion = {
  id: number;
  version: number;
  label: string;
  createdAt: string | Date;
  createdById?: number | null;
  author?: { id: number; name: string; email: string } | null;
};

type StudioState = {
  activeThemeId: number;
  activeVersionId?: number | null;
  design: SiteDesign;
  themes: unknown[];
  versions: DesignVersion[];
  hasUnpublishedChanges: boolean;
};

type NavItem = { href: string; label: string; visible: boolean; openInNewTab?: boolean };
type CatalogSectionEditorItem = { id: number; name: string; slug: string; eyebrow: string; description: string; baseAudience: "WOMEN" | "MEN" | "KIDS"; isSystem: boolean; isActive: boolean; sortOrder: number; _count?: { categories: number; products: number } };
type Selection = "page" | "image" | "brand" | "colors" | "menu" | "sections" | "footer";
type UniversalTextEntry = { key: string; text: string; tag: string; context: string };
type UniversalTextOverrides = Record<string, string>;
type Device = "desktop" | "tablet" | "mobile";

const PREVIEW_WIDTHS: Record<Device, number> = {
  desktop: 1440,
  tablet: 834,
  mobile: 390,
};

const PREVIEW_HEIGHTS: Record<Device, number> = {
  desktop: 1180,
  tablet: 1112,
  mobile: 844,
};

const MOBILE_PRESETS = [
  { width: 360, label: "Малък телефон · 360px" },
  { width: 390, label: "Стандартен телефон · 390px" },
  { width: 430, label: "Голям телефон · 430px" },
];

type EditorProps = {
  initialState: StudioState;
  standalone?: boolean;
};


const PAGE_CAPABILITIES: Record<EditablePageKey, { text: boolean; button: boolean; image: boolean }> = {
  home: { text: true, button: true, image: true },
  women: { text: true, button: false, image: false },
  men: { text: true, button: false, image: false },
  kids: { text: true, button: false, image: false },
  new: { text: true, button: false, image: false },
  sale: { text: true, button: false, image: false },
  about: { text: true, button: true, image: true },
  contact: { text: true, button: false, image: false },
  cart: { text: true, button: false, image: false },
  checkout: { text: true, button: false, image: false },
  login: { text: true, button: false, image: false },
  register: { text: true, button: false, image: false },
  account: { text: true, button: false, image: false },
  favorites: { text: true, button: false, image: false },
  history: { text: true, button: false, image: false },
  search: { text: true, button: false, image: false },
};

const pages: { key: EditablePageKey; label: string; path: string }[] = [
  { key: "home", label: "Начална страница", path: "/" },
  { key: "women", label: "Дамско", path: "/women" },
  { key: "men", label: "Мъжко", path: "/men" },
  { key: "kids", label: "Детско", path: "/kids" },
  { key: "new", label: "Нови", path: "/new" },
  { key: "sale", label: "Промоции", path: "/sale" },
  { key: "about", label: "За нас", path: "/about" },
  { key: "contact", label: "Контакти", path: "/contact" },
  { key: "cart", label: "Количка", path: "/cart" },
  { key: "checkout", label: "Поръчка", path: "/checkout" },
  { key: "login", label: "Вход", path: "/login" },
  { key: "register", label: "Регистрация", path: "/register" },
  { key: "account", label: "Профил", path: "/account" },
  { key: "favorites", label: "Любими", path: "/favorites" },
  { key: "history", label: "Хронология", path: "/history" },
  { key: "search", label: "Търсене", path: "/search" },
];

function parseNavItems(value: string): NavItem[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? (parsed as NavItem[]) : [];
  } catch {
    return [];
  }
}

function parseDesignTokens(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getUniversalTextOverrides(design: Pick<SiteDesign, "designTokensJson">): UniversalTextOverrides {
  try {
    const tokens = parseDesignTokens(design.designTokensJson);
    const raw = typeof tokens["content.textOverrides"] === "string" ? tokens["content.textOverrides"] as string : "{}";
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string")) as UniversalTextOverrides
      : {};
  } catch { return {}; }
}

function withUniversalTextOverride(design: Pick<SiteDesign, "designTokensJson">, key: string, value: string) {
  const tokens = parseDesignTokens(design.designTokensJson);
  const overrides = getUniversalTextOverrides(design);
  if (value.trim()) overrides[key] = value;
  else delete overrides[key];
  tokens["content.textOverrides"] = JSON.stringify(overrides);
  return JSON.stringify(tokens);
}

function readHeroImages(design: SiteDesign): string[] {
  const tokens = parseDesignTokens(design.designTokensJson);
  const stored = tokens["hero.images"];
  if (Array.isArray(stored)) {
    const images = stored.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4);
    if (images.length) return images;
  }
  return design.heroImageUrl.trim() ? [design.heroImageUrl.trim()] : [];
}

function getLogoSize(design: SiteDesign) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  const raw = String(tokens["header.logoImageWidth"] ?? "112px");
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(40, Math.min(330, value)) : 112;
}

function withLogoSize(design: SiteDesign, size: number) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  tokens["header.logoImageWidth"] = `${Math.max(40, Math.min(330, Math.round(size)))}px`;
  return serializeDesignTokenOverrides(tokens);
}

function getNumericToken(design: SiteDesign, key: string, fallback: number) {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  const value = Number.parseFloat(String(tokens[key] ?? fallback));
  return Number.isFinite(value) ? value : fallback;
}

function withNumericToken(design: SiteDesign, key: string, value: number, suffix = "") {
  const tokens = parseDesignTokenOverrides(design.designTokensJson);
  tokens[key] = `${Math.round(value * 100) / 100}${suffix}`;
  return serializeDesignTokenOverrides(tokens);
}

export default function WebDesignEditor({ initialState, standalone = false }: EditorProps) {
  const [design, setDesign] = useState(initialState.design);
  const [pageKey, setPageKey] = useState<EditablePageKey>("home");
  const [catalogSections, setCatalogSections] = useState<CatalogSectionEditorItem[]>([]);
  const [selected, setSelected] = useState<Selection>("page");
  const [device, setDevice] = useState<Device>("desktop");
  const [mobilePreviewWidth, setMobilePreviewWidth] = useState(PREVIEW_WIDTHS.mobile);
  const previewWidth = device === "mobile" ? mobilePreviewWidth : PREVIEW_WIDTHS[device];
  const previewHeight = PREVIEW_HEIGHTS[device];
  const [zoom, setZoom] = useState(82);
  const stageScrollerRef = useRef<HTMLDivElement | null>(null);
  const autoFitRef = useRef(true);

  const fitPreviewToStage = useCallback(() => {
    const stage = stageScrollerRef.current;
    if (!stage) return;
    const horizontalRoom = Math.max(240, stage.clientWidth - 40);
    const verticalRoom = Math.max(240, stage.clientHeight - 40);
    const naturalWidth = previewWidth + 22;
    const naturalHeight = previewHeight + 56;
    const widthScale = horizontalRoom / naturalWidth;
    const heightScale = verticalRoom / naturalHeight;
    const nextZoom = Math.max(8, Math.min(100, Math.floor(Math.min(widthScale, heightScale) * 100)));
    setZoom(nextZoom);
  }, [previewHeight, previewWidth]);

  useEffect(() => {
    const stage = stageScrollerRef.current;
    if (!stage) return;
    autoFitRef.current = true;
    const fitWhenAutomatic = () => {
      if (autoFitRef.current) fitPreviewToStage();
    };
    const observer = new ResizeObserver(fitWhenAutomatic);
    observer.observe(stage);
    const frame = window.requestAnimationFrame(fitWhenAutomatic);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [device, fitPreviewToStage]);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [readyPreviewId, setReadyPreviewId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(Boolean(initialState.hasUnpublishedChanges));
  const [message, setMessage] = useState("Натисни елемент от страницата, за да го редактираш.");
  const [universalTextEntries, setUniversalTextEntries] = useState<UniversalTextEntry[]>([]);
  const [versions, setVersions] = useState<DesignVersion[]>(initialState.versions ?? []);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(initialState.activeVersionId ?? initialState.versions?.[0]?.id ?? null);
  const [saveDialog, setSaveDialog] = useState<{ publish: boolean } | null>(null);
  const [versionName, setVersionName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingHeroSlotRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const designRef = useRef<SiteDesign>(initialState.design);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const previewReloadCounterRef = useRef(0);

  useEffect(() => {
    designRef.current = design;
  }, [design]);

  useEffect(() => {
    if (!standalone) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;

    html.style.height = "100%";
    html.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.height = previousHtmlHeight;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
    };
  }, [standalone]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    fetch("/api/admin/catalog-sections", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { sections: [] })
      .then((data) => {
        if (mounted) setCatalogSections(Array.isArray(data.sections) ? data.sections : []);
      })
      .catch(() => {
        if (mounted) setCatalogSections([]);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const refreshCatalogSections = useCallback(async () => {
    const response = await fetch("/api/admin/catalog-sections", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Секциите не бяха заредени.");
    setCatalogSections(Array.isArray(data.sections) ? data.sections : []);
  }, []);

  const contentMap = useMemo(
    () => parsePageContent(design.pageContentJson),
    [design.pageContentJson],
  );
  const storedPage = contentMap[pageKey] || DEFAULT_PAGE_CONTENT[pageKey];
  const page = useMemo<EditablePageContent>(
    () => pageKey === "home"
      ? {
          eyebrow: design.heroEyebrow,
          title: design.heroTitle,
          description: design.heroDescription,
          buttonText: design.heroButtonText,
          buttonHref: design.heroButtonHref,
          imageUrl: design.heroImageUrl,
          imageVisible: true,
        }
      : storedPage,
    [design.heroButtonHref, design.heroButtonText, design.heroDescription, design.heroEyebrow, design.heroImageUrl, design.heroTitle, pageKey, storedPage],
  );
  const nav = parseNavItems(design.navigationItemsJson);
  const pageLinkOptions = useMemo<PageLinkOption[]>(() => [
    ...STORE_PAGE_LINK_OPTIONS,
    ...catalogSections.filter((section) => section.isActive).map((section) => ({ label: section.name, value: `/${section.slug}`, group: "Секции" })),
  ], [catalogSections]);
  const activePage = pages.find((item) => item.key === pageKey) ?? pages[0];
  const pageCapabilities = PAGE_CAPABILITIES[pageKey];
  const heroImages = useMemo(() => readHeroImages(design), [design]);

  useEffect(() => {
    if (selected === "image" && !pageCapabilities.image) {
      setSelected(pageCapabilities.text ? "page" : "colors");
      return;
    }
    if (selected === "page" && !pageCapabilities.text) setSelected("colors");
  }, [pageCapabilities.image, pageCapabilities.text, selected]);

  const set = <K extends keyof SiteDesign>(key: K, value: SiteDesign[K]) => {
    setDesign((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const setPage = (patch: Partial<EditablePageContent>) => {
    if (pageKey === "home") {
      const mapping: Partial<Record<keyof EditablePageContent, keyof SiteDesign>> = {
        eyebrow: "heroEyebrow",
        title: "heroTitle",
        description: "heroDescription",
        buttonText: "heroButtonText",
        buttonHref: "heroButtonHref",
        imageUrl: "heroImageUrl",
      };
      setDesign((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(patch)) {
          const target = mapping[key as keyof EditablePageContent];
          if (target) (next as Record<string, unknown>)[target] = value;
        }
        return next;
      });
      setDirty(true);
      return;
    }

    set(
      "pageContentJson",
      JSON.stringify({
        ...contentMap,
        [pageKey]: { ...page, ...patch },
      }) as SiteDesign["pageContentJson"],
    );
  };

  const setNav = (items: NavItem[]) => {
    set("navigationItemsJson", JSON.stringify(items));
  };

  async function refreshVersions() {
    if (initialState.activeThemeId < 1) return;
    const response = await fetch(`/api/admin/design-studio/versions?themeId=${initialState.activeThemeId}`, { cache: "no-store" });
    const result = (await response.json()) as { versions?: DesignVersion[]; activeVersionId?: number | null; error?: string };
    if (!response.ok) throw new Error(result.error || "Грешка при зареждане на хронологията.");
    const nextVersions = result.versions ?? [];
    setVersions(nextVersions);
    setActiveVersionId(result.activeVersionId ?? null);
  }

  function reloadPreviewFrame() {
    previewReloadCounterRef.current += 1;
    setReadyPreviewId(null);
    setPreviewReloadKey(() => Date.now() + previewReloadCounterRef.current);
  }

  function pushDesignToPreview(snapshot: SiteDesign) {
    const frame = previewRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "zlatevi:theme-snapshot-preview", snapshot }, window.location.origin);
    frame.contentWindow.postMessage({ type: "zlatevi:text-overrides-preview", overrides: getUniversalTextOverrides(snapshot) }, window.location.origin);
  }

  function requestSave(publish: boolean) {
    const nextNumber = (versions[0]?.version ?? 0) + 1;
    setVersionName(`${publish ? "Публикувана" : "Работна"} версия ${nextNumber}`);
    setSaveDialog({ publish });
  }

  async function saveVersion() {
    if (!saveDialog) return;
    const label = versionName.trim();
    if (label.length < 2) {
      setMessage("Въведи име на версията.");
      return;
    }
    setSaving(true);
    try {
      const designToSave = designRef.current;

      // "Запиши" is version history only. It must not change the live
      // storefront. Publishing/applying is a separate explicit action.
      // Keeping these operations separate also prevents a partial state where
      // siteDesignSettings is changed but creating the history version fails.
      let savedVersionId: number | null = null;
      if (initialState.activeThemeId > 0) {
        const response = await fetch("/api/admin/design-studio/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ themeId: initialState.activeThemeId, snapshot: designToSave, label }),
        });
        const result = (await response.json()) as { error?: string; version?: DesignVersion };
        if (!response.ok) throw new Error(result.error || "Версията не можа да бъде записана в хронологията.");
        savedVersionId = result.version?.id ?? null;
        await refreshVersions();
      } else {
        throw new Error("Няма активна тема, към която да бъде записана версия.");
      }

      if (savedVersionId) setActiveVersionId(savedVersionId);
      designRef.current = designToSave;
      setDesign(designToSave);
      pushDesignToPreview(designToSave);
      setDirty(false);
      setSaveDialog(null);
      setMessage(`Версия „${label}“ е запазена в хронологията. Натисни „Публикувай“, за да я приложиш в реалния магазин.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Грешка при запис.");
    } finally {
      setSaving(false);
    }
  }

  async function applyDesignForTest() {
    setPublishing(true);
    setMessage("Публикува се текущият дизайн в реалния магазин…");
    try {
      const designToApply = designRef.current;
      const response = initialState.activeThemeId > 0
        ? await fetch("/api/admin/design-studio/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ themeId: initialState.activeThemeId, snapshot: designToApply }),
          })
        : await fetch("/api/admin/site-design", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(designToApply),
          });

      const result = (await response.json()) as { snapshot?: SiteDesign; activeVersionId?: number | null; error?: string };
      if (!response.ok) throw new Error(result.error || "Грешка при прилагане на темата.");

      const appliedSnapshot = result.snapshot ?? designToApply;
      designRef.current = appliedSnapshot;
      setDesign(appliedSnapshot);
      if (typeof result.activeVersionId !== "undefined") setActiveVersionId(result.activeVersionId);
      pushDesignToPreview(appliedSnapshot);
      reloadPreviewFrame();
      window.setTimeout(() => pushDesignToPreview(appliedSnapshot), 120);
      setDirty(false);
      setMessage("Дизайнът е публикуван в реалния магазин. Не е създадена нова версия.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Грешка при прилагане на темата.");
    } finally {
      setPublishing(false);
    }
  }

  async function restoreVersion(version: DesignVersion) {
    if (initialState.activeThemeId < 1) {
      setMessage("Няма активна тема за избор на версия.");
      return;
    }
    setRestoringId(version.id);
    try {
      const response = await fetch("/api/admin/design-studio/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: initialState.activeThemeId, versionId: version.id }),
      });
      const result = (await response.json()) as { snapshot?: SiteDesign; error?: string };
      if (!response.ok || !result.snapshot) throw new Error(result.error || "Грешка при избор на тема.");
      designRef.current = result.snapshot;
      setDesign(result.snapshot);
      setActiveVersionId(version.id);
      pushDesignToPreview(result.snapshot);
      reloadPreviewFrame();
      window.setTimeout(() => pushDesignToPreview(result.snapshot as SiteDesign), 120);
      setHistoryOpen(false);
      setDirty(false);
      setMessage(`Версия „${version.label}“ е избрана и приложена веднага. Preview-то е презаредено.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Грешка при избор на тема.");
    } finally {
      setRestoringId(null);
    }
  }

  async function deleteVersion(version: DesignVersion) {
    if (initialState.activeThemeId < 1) {
      setMessage("Няма активна тема за изтриване на хронология.");
      return;
    }
    if (!window.confirm(`Да изтрия ли версия ${version.version} – „${version.label}“ от хронологията?`)) return;
    setRestoringId(version.id);
    try {
      const response = await fetch("/api/admin/design-studio/versions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: initialState.activeThemeId, versionId: version.id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Грешка при изтриване на версията.");
      await refreshVersions();
      setMessage(`Версия „${version.label}“ е изтрита от хронологията.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Грешка при изтриване на версията.");
    } finally {
      setRestoringId(null);
    }
  }

  function updateHeroImages(nextImages: string[]) {
    const images = nextImages.map((item) => item.trim()).filter(Boolean).slice(0, 4);
    setDesign((current) => {
      const tokens = parseDesignTokens(current.designTokensJson);
      tokens["hero.images"] = images;
      return {
        ...current,
        heroImageUrl: images[0] || "",
        designTokensJson: JSON.stringify(tokens),
      };
    });
    setDirty(true);
  }

  function chooseHeroImage(slot: number) {
    pendingHeroSlotRef.current = slot;
    fileRef.current?.click();
  }

  function changeHeroImageUrl(slot: number, value: string) {
    const next = [...heroImages];
    while (next.length <= slot) next.push("");
    next[slot] = value;
    updateHeroImages(next);
  }

  function removeHeroImage(slot: number) {
    updateHeroImages(heroImages.filter((_, index) => index !== slot));
  }

  async function upload(file: File) {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/site-design/upload", { method: "POST", body });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setMessage(result.error || "Грешка при качване.");
      return;
    }
    if (selected === "brand") {
      set("logoUrl", result.url);
    } else if (pageKey === "home" && pendingHeroSlotRef.current !== null) {
      const slot = pendingHeroSlotRef.current;
      const next = [...heroImages];
      while (next.length <= slot) next.push("");
      next[slot] = result.url;
      updateHeroImages(next);
      pendingHeroSlotRef.current = null;
    } else {
      setPage({ imageUrl: result.url });
    }
    setMessage("Изображението е сменено. Натисни „Запиши“.");
  }

  const updateUniversalText = useCallback((key: string, value: string) => {
    setDesign((current) => ({ ...current, designTokensJson: withUniversalTextOverride(current, key, value) }));
    setDirty(true);
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const handlePreviewReady = (event: MessageEvent) => {
      const frame = previewRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "zlatevi:text-editor-scan") {
        setUniversalTextEntries(Array.isArray(event.data.entries) ? event.data.entries as UniversalTextEntry[] : []);
        return;
      }
      if (event.data?.type === "zlatevi:text-editor-inline-change" && typeof event.data.key === "string" && typeof event.data.value === "string") {
        updateUniversalText(event.data.key, event.data.value);
        setMessage("Текстът е променен директно в прегледа. Натисни „Запиши“.");
        return;
      }
      if (event.data?.type !== "zlatevi:visual-editor-preview-ready") return;
      const pathname = typeof event.data.pathname === "string" ? event.data.pathname : "";
      const messageDevice = typeof event.data.device === "string" ? event.data.device : "";
      const viewport = typeof event.data.viewport === "string" ? event.data.viewport : "";
      const nextPreviewId = `${pathname}:${messageDevice}:${viewport}`;
      setReadyPreviewId((current) => current === nextPreviewId ? current : nextPreviewId);
      frame.contentWindow?.postMessage({ type: "zlatevi:text-editor-request-scan" }, window.location.origin);
    };

    window.addEventListener("message", handlePreviewReady);
    return () => window.removeEventListener("message", handlePreviewReady);
  }, [updateUniversalText]);

  useEffect(() => {
    const frame = previewRef.current;
    const expectedPreviewId = `${activePage.path}:${device}:${previewWidth}`;
    if (!frame || readyPreviewId !== expectedPreviewId) return;

    const applyPreview = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        const root = doc.documentElement;
        // The colour palette is global for the whole storefront. Apply the same
        // CSS variables generated by compileDesignCss(), with inline !important
        // priority so the live preview cannot be overwritten by the page's
        // initial server-rendered theme or by a later client refresh.
        const headerPalette = deriveHeaderPalette(design.primaryColor);
        const liveTokens: Record<string, string> = {
          "--brand-primary": design.primaryColor,
          "--header-bg-start": headerPalette.headerStart,
          "--header-bg-end": headerPalette.headerEnd,
          "--header-utility-bg": headerPalette.utility,
          "--header-nav-bg": headerPalette.navigation,
          "--header-search-bg": headerPalette.search,
          "--header-mobile-bg": headerPalette.mobileDrawer,
          "--header-logo-image-width": `${getLogoSize(design)}px`,
          "--brand-secondary": design.secondaryColor,
          "--theme-primary": design.primaryColor,
          "--theme-accent": design.secondaryColor,
          "--theme-bg": design.lightBackground,
          "--theme-surface": design.lightSurface,
          "--theme-text": design.lightText,
          "--wine-800": design.primaryColor,
          "--gold-500": design.secondaryColor,
          "--cream": design.lightBackground,
          "--paper": design.lightSurface,
          "--ink": design.lightText,
          "--brand-radius": `${design.borderRadius}px`,
          "--radius-lg": `${design.borderRadius}px`,
          "--brand-font": design.fontFamily,
          "--brand-heading-font": design.headingFontFamily,
          "--font-body": design.fontFamily,
          "--font-heading": design.headingFontFamily,
        };
        for (const [token, value] of Object.entries(liveTokens)) {
          root.style.setProperty(token, value, "important");
        }

        // The preview is the real storefront. Some older CSS modules still have
        // fixed brand colours, so inject one live override sheet that references
        // the global tokens. Reusing the same style element makes every input event
        // update immediately without reloading the iframe or saving a draft.
        let liveStyle = doc.getElementById("zlatevi-live-brand-preview") as HTMLStyleElement | null;
        if (!liveStyle) {
          liveStyle = doc.createElement("style");
          liveStyle.id = "zlatevi-live-brand-preview";
          doc.head.appendChild(liveStyle);
        }
        liveStyle.textContent = `
          html, body { min-height: 100% !important; height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; overscroll-behavior: contain !important; scrollbar-gutter: stable; }
          [data-storefront-root] { min-height: 100% !important; overflow: visible !important; }
          [data-storefront-root] header[class*="header" i] { background: radial-gradient(circle at 22% 0%, color-mix(in srgb, var(--brand-primary) 88%, white 12% / 22%), transparent 33%), linear-gradient(180deg, var(--header-bg-start), var(--header-bg-end)) !important; }
          [data-storefront-root] [class*="utilityBar" i] { background: var(--header-utility-bg) !important; }
          [data-storefront-root] [class*="mainBar" i] { background: var(--brand-primary) !important; }
          [data-storefront-root] [class*="desktopNav" i] { background: var(--header-nav-bg) !important; }
          [data-storefront-root] form[class*="search" i], [data-storefront-root] [class*="mobileSearch" i] { background: var(--header-search-bg) !important; }
          [data-storefront-root] [class*="mobileDrawer" i] { background: var(--brand-primary) !important; background-color: var(--brand-primary) !important; background-image: none !important; opacity: 1 !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; mix-blend-mode: normal !important; }
          [data-storefront-root] main[class*="main" i] { background: var(--theme-bg) !important; color: var(--theme-text) !important; }
          [data-storefront-root] [class*="heroShade" i] { background: linear-gradient(90deg, color-mix(in srgb, var(--brand-primary) 96%, black 4%) 0%, color-mix(in srgb, var(--brand-primary) 86%, transparent) 42%, color-mix(in srgb, var(--brand-primary) 20%, transparent) 74%), linear-gradient(0deg, color-mix(in srgb, var(--brand-primary) 28%, transparent), transparent) !important; }
          [data-storefront-root] [class*="heroContent" i] > span, [data-storefront-root] [class*="sliderArrow" i] { color: var(--brand-secondary) !important; }
          [data-storefront-root] [class*="heroContent" i] a { background: linear-gradient(135deg, color-mix(in srgb, var(--brand-secondary) 78%, white 22%), var(--brand-secondary)) !important; color: color-mix(in srgb, var(--brand-primary) 72%, black 28%) !important; }
          [data-storefront-root] [class*="dots" i] button[class*="activeDot" i] { background: var(--brand-secondary) !important; }
          [data-storefront-root] footer[class*="footer" i], [data-storefront-root] [class*="storeFooter" i] { background: var(--brand-primary) !important; }
          [data-storefront-root] [class*="sectionTitle" i] span { background: linear-gradient(90deg, transparent, var(--brand-secondary)) !important; }
          [data-storefront-root] [class*="sectionTitle" i] span:last-child { background: linear-gradient(90deg, var(--brand-secondary), transparent) !important; }
          [data-storefront-root] [class*="categoryCard" i] b { border-color: var(--brand-secondary) !important; color: var(--brand-primary) !important; }
          @media (max-width: 640px) {
            [data-storefront-root] { --mobile-horizontal-padding: ${getNumericToken(design, "responsive.mobile.horizontalPadding", 16)}px; }
            [data-storefront-root] header img { max-width: ${getNumericToken(design, "responsive.mobile.logoImageWidth", 150)}px !important; }
            [data-storefront-root] main, [data-storefront-root] section { scroll-margin-top: 70px; }
            [data-storefront-root] [class*="hero" i] { min-height: ${getNumericToken(design, "responsive.mobile.heroMinHeight", 520)}px !important; }
            [data-storefront-root] [class*="heroContent" i], [data-storefront-root] [class*="content" i] { padding-left: var(--mobile-horizontal-padding) !important; padding-right: var(--mobile-horizontal-padding) !important; }
            [data-storefront-root] [class*="productGrid" i], [data-storefront-root] [class*="grid" i] { grid-template-columns: repeat(${Math.max(1, Math.min(2, Math.round(getNumericToken(design, "responsive.mobile.productColumns", 1))))}, minmax(0, 1fr)) !important; }
          }
        `;

        // Force the visible document surfaces to react immediately as well.
        // Individual components continue to use the global variables above.
        doc.body.style.setProperty("background-color", design.lightBackground, "important");
        doc.body.style.setProperty("color", design.lightText, "important");

        const logos = Array.from(doc.querySelectorAll<HTMLImageElement>('header img, [data-storefront-root] header img'));
        for (const logo of logos) {
          const logoWrapper = logo.closest('a, button, div');
          if (design.logoUrl) {
            logo.removeAttribute("srcset");
            logo.src = design.logoUrl;
            logo.style.removeProperty("display");
            logoWrapper?.removeAttribute("data-logo-deleted");
            if (logoWrapper instanceof HTMLElement) logoWrapper.style.removeProperty("visibility");
          } else {
            logo.removeAttribute("srcset");
            logo.removeAttribute("src");
            logo.style.display = "none";
            logoWrapper?.setAttribute("data-logo-deleted", "true");
            if (logoWrapper instanceof HTMLElement) logoWrapper.style.visibility = "hidden";
          }
        }

        if (pageKey === "home") {
          const hero = doc.querySelector('main section');
          if (hero) {
            const eyebrow = hero.querySelector('span');
            const title = hero.querySelector('h1');
            const description = hero.querySelector('p');
            const button = hero.querySelector('a');
            if (eyebrow) eyebrow.textContent = page.eyebrow;
            if (title) title.textContent = page.title;
            if (description) description.textContent = page.description;
            if (button) {
              const label = button.querySelector("span") ?? button;
              label.textContent = page.buttonText.trim();
              button.setAttribute("href", page.buttonHref || "/");
            }
            if (page.imageUrl) (hero as HTMLElement).style.setProperty('--hero-image', `url("${page.imageUrl.replaceAll('"','')}")`);
            frame.contentWindow?.postMessage({ type: "zlatevi:hero-images-preview", images: heroImages }, window.location.origin);
          }
        }
        if (pageKey === "about") {
          const mark = doc.querySelector<HTMLElement>('[data-about-hero-mark]');
          const image = doc.querySelector<HTMLImageElement>('[data-about-hero-image]');
          const fallback = doc.querySelector<HTMLElement>('[data-about-hero-fallback]');
          const hero = doc.querySelector<HTMLElement>('[data-about-hero]');
          if (mark) mark.style.display = page.imageVisible ? "grid" : "none";
          if (hero) hero.dataset.imageHidden = page.imageVisible ? "false" : "true";
          if (image) {
            if (page.imageUrl) { image.src = page.imageUrl; image.style.display = "block"; }
            else image.style.display = "none";
          }
          if (fallback) fallback.style.display = page.imageUrl ? "none" : "grid";
        }
      } catch {
        // Same-origin preview; ignore transient navigation states.
      }
    };

    applyPreview();
  }, [activePage.path, design, device, heroImages, page, pageKey, previewWidth, readyPreviewId]);

  useEffect(() => {
    const frame = previewRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "zlatevi:text-overrides-preview", overrides: getUniversalTextOverrides(design) }, window.location.origin);
  }, [design, readyPreviewId]);

  useEffect(() => {
    const frame = previewRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "zlatevi:text-editor-mode", enabled: selected === "page" }, window.location.origin);
  }, [selected, readyPreviewId, activePage.path]);

  const focusUniversalText = (key: string) => {
    previewRef.current?.contentWindow?.postMessage({ type: "zlatevi:text-editor-focus", key }, window.location.origin);
  };

  const vars = {
    "--editor-primary": design.primaryColor,
    "--editor-accent": design.secondaryColor,
    "--editor-bg": design.lightBackground,
    "--editor-surface": design.lightSurface,
    "--editor-text": design.lightText,
    "--editor-radius": `${design.borderRadius}px`,
    "--editor-font": design.fontFamily,
    "--editor-heading": design.headingFontFamily,
    "--editor-zoom": `${zoom / 100}`,
  } as CSSProperties;

  return (
    <div className={`${styles.editor} ${standalone ? styles.standalone : ""}`} style={vars}>
      <header className={styles.appBar}>
        <div className={styles.appIdentity}>
          <span className={styles.appLogo}>Z</span>
          <div>
            <strong>Визуален редактор</strong>
            <span>Online Store · Дизайн на магазина</span>
          </div>
        </div>

        <div className={styles.pageChooser}>
          <span>Страница</span>
          <select
            value={pageKey}
            onChange={(event) => {
              setPageKey(event.target.value as EditablePageKey);
              setSelected("page");
            }}
          >
            {pages.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.appActions}>
          <a href={activePage.path} target="_blank" rel="noreferrer">
            Преглед
          </a>
          <button type="button" className={styles.historyButton} onClick={() => setHistoryOpen(true)}>
            Хронология
          </button>
          <button type="button" onClick={() => requestSave(false)} disabled={saving}>
            Запиши
          </button>
          <button
            type="button"
            className={styles.publishButton}
            onClick={() => void applyDesignForTest()}
            disabled={hydrated ? publishing : false}
            title="Прилага текущия дизайн в реалния магазин без да създава нова версия"
          >
            {publishing ? "Прилага…" : "Публикувай"}
          </button>
          {standalone && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => window.close()}
              aria-label="Затвори редактора"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className={styles.application}>
        <aside className={styles.toolRail} aria-label="Инструменти">
          {pageCapabilities.text && (
            <>
              <ToolButton icon="↖" label="Избор" active={selected === "page"} onClick={() => setSelected("page")} />
              <ToolButton icon="T" label="Текст" active={selected === "page"} onClick={() => setSelected("page")} />
            </>
          )}
          {pageCapabilities.image && (
            <ToolButton icon="▧" label="Снимка" active={selected === "image"} onClick={() => setSelected("image")} />
          )}
          <ToolButton icon="▥" label="Секции" active={selected === "sections"} onClick={() => setSelected("sections")} />
          <ToolButton icon="☰" label="Меню" active={selected === "menu"} onClick={() => setSelected("menu")} />
          <ToolButton icon="Z" label="Лого" active={selected === "brand"} onClick={() => setSelected("brand")} />
          <ToolButton icon="◉" label="Цветове" active={selected === "colors"} onClick={() => setSelected("colors")} />
          <ToolButton icon="▤" label="Footer" active={selected === "footer"} onClick={() => setSelected("footer")} />
        </aside>

        <section className={styles.stageArea}>
          <div className={styles.stageToolbar}>
            <div className={styles.deviceButtons}>
              {(["desktop", "tablet", "mobile"] as Device[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={device === value ? styles.activeDevice : ""}
                  onClick={() => {
                    autoFitRef.current = true;
                    setDevice(value);
                  }}
                >
                  {value === "desktop" ? "▰ Компютър" : value === "tablet" ? "▯ Таблет" : "▯ Телефон"}
                </button>
              ))}
            </div>
            {device === "mobile" && (
              <label className={styles.mobilePreset}>
                <span>Размер</span>
                <select value={mobilePreviewWidth} onChange={(event) => {
                  autoFitRef.current = true;
                  setMobilePreviewWidth(Number(event.target.value));
                }}>
                  {MOBILE_PRESETS.map((preset) => <option key={preset.width} value={preset.width}>{preset.label}</option>)}
                </select>
              </label>
            )}
            <div className={styles.zoomControl}>
              <button type="button" onClick={() => {
                autoFitRef.current = false;
                setZoom((value) => Math.max(8, value - 10));
              }}>−</button>
              <input
                type="range"
                min="8"
                max="120"
                step="5"
                value={zoom}
                onChange={(event) => {
                  autoFitRef.current = false;
                  setZoom(Number(event.target.value));
                }}
              />
              <span>{zoom}%</span>
              <button type="button" onClick={() => {
                autoFitRef.current = false;
                setZoom((value) => Math.min(120, value + 10));
              }}>+</button>
              <button type="button" className={styles.fitButton} onClick={() => {
                autoFitRef.current = true;
                fitPreviewToStage();
              }} title="Побери прегледа във фрейма">Побери</button>
            </div>
          </div>

          <div ref={stageScrollerRef} className={styles.stageScroller}>
            <div
              className={styles.frameScaleShell}
              style={{
                width: `${(previewWidth + 22) * (zoom / 100)}px`,
                height: `${(previewHeight + 56) * (zoom / 100)}px`,
              }}
            >
              <div
                className={`${styles.deviceFrame} ${styles[device]}`}
                style={{
                  width: `${previewWidth}px`,
                  minWidth: `${previewWidth}px`,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top left",
                  "--preview-width": `${previewWidth}px`,
                  "--preview-height": `${previewHeight}px`,
                } as CSSProperties}
              >
              <div className={styles.browserChrome}>
                <span />
                <span />
                <span />
                <div>{`localhost:3000${activePage.path}`}</div>
              </div>
              <div
                className={styles.previewViewport}
                style={{ height: `${previewHeight}px` }}
              >
                <iframe
                  key={`${device}-${activePage.path}-${previewReloadKey}`}
                  ref={previewRef}
                  className={styles.livePreview}
                  width={previewWidth}
                  height={previewHeight}
                  scrolling="yes"
                  style={{ width: `${previewWidth}px`, minWidth: `${previewWidth}px`, height: `${previewHeight}px` }}
                  src={`${activePage.path}?visualEditorPreview=1&device=${device}&viewport=${previewWidth}&editorReload=${previewReloadKey}`}
                  title={`Реален преглед: ${activePage.label}`}
                  onLoad={() => {
                    setMessage(
                      `Зарежда се реалната страница при ${previewWidth}px ширина (${device === "desktop" ? "компютър" : device === "tablet" ? "таблет" : "телефон"})…`,
                    );
                  }}
                />
              </div>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.inspector}>
          <Inspector
            selected={selected}
            design={design}
            page={page}
            pageKey={pageKey}
            capabilities={pageCapabilities}
            nav={nav}
            catalogSections={catalogSections}
            pageLinkOptions={pageLinkOptions}
            refreshCatalogSections={refreshCatalogSections}
            set={set}
            setPage={setPage}
            setNav={setNav}
            fileRef={fileRef}
            heroImages={heroImages}
            chooseHeroImage={chooseHeroImage}
            changeHeroImageUrl={changeHeroImageUrl}
            removeHeroImage={removeHeroImage}
            device={device}
            universalTextEntries={universalTextEntries}
            universalTextOverrides={getUniversalTextOverrides(design)}
            updateUniversalText={updateUniversalText}
            focusUniversalText={focusUniversalText}
          />
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <div className={styles.statusMessage}>{message}</div>
        </aside>
      </div>

      {saveDialog && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => !saving && setSaveDialog(null)}>
          <section className={styles.versionDialog} role="dialog" aria-modal="true" aria-labelledby="version-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.dialogIcon}>{saveDialog.publish ? "✓" : "V"}</div>
            <div className={styles.dialogHeading}>
              <small>{saveDialog.publish ? "Публикуване" : "Нова версия"}</small>
              <h2 id="version-dialog-title">Как да се казва версията?</h2>
              <p>Ще запазим пълно копие на дизайна, за да можеш по всяко време да се върнеш към него.</p>
            </div>
            <label className={styles.versionNameField}>
              Име на версията
              <input
                autoFocus
                maxLength={120}
                value={versionName}
                onChange={(event) => setVersionName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void saveVersion(); }}
                placeholder="Например: Нова начална страница"
              />
              <span>{versionName.trim().length}/120</span>
            </label>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setSaveDialog(null)} disabled={saving}>Отказ</button>
              <button type="button" className={styles.dialogPrimary} onClick={() => void saveVersion()} disabled={saving || versionName.trim().length < 2}>
                {saving ? "Записване…" : "Запиши версия"}
              </button>
            </div>
          </section>
        </div>
      )}

      {historyOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setHistoryOpen(false)}>
          <section className={styles.historyDialog} role="dialog" aria-modal="true" aria-labelledby="history-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.historyHeader}>
              <div>
                <small>Дизайн на магазина</small>
                <h2 id="history-dialog-title">Хронология на версиите</h2>
                <p>Текущата тема е осветена. Изборът на версия я прилага веднага без да създава нов запис.</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Затвори">×</button>
            </header>
            <div className={styles.versionTimeline}>
              {versions.length === 0 ? (
                <div className={styles.emptyHistory}>Все още няма записани версии.</div>
              ) : versions.map((version, index) => {
                const isCurrent = version.id === activeVersionId;
                return (
                <article className={`${styles.versionRow} ${isCurrent ? styles.currentVersionRow : ""}`} key={version.id}>
                  <div className={styles.timelineMarker}><span>{version.version}</span></div>
                  <div className={styles.versionInfo}>
                    <div className={styles.versionTitleLine}>
                      <strong>{version.label}</strong>
                      {isCurrent && <em className={styles.currentVersionBadge}>Текуща избрана тема</em>}
                      {index === 0 && !isCurrent && <em>Най-нова</em>}
                    </div>
                    <span>{new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</span>
                    <small>{version.author ? `${version.author.name} · ${version.author.email}` : version.createdById ? `Администратор #${version.createdById}` : "Система"}</small>
                  </div>
                  <div className={styles.versionActions}>
                    <button type="button" onClick={() => void restoreVersion(version)} disabled={restoringId === version.id || isCurrent}>
                      {restoringId === version.id ? "Прилагане…" : isCurrent ? "Текуща тема" : "Избери тема"}
                    </button>
                    <button type="button" className={styles.versionDeleteButton} onClick={() => void deleteVersion(version)} disabled={restoringId === version.id}>
                      Изтрий
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.toolButton} ${active ? styles.activeTool : ""}`}
      onClick={onClick}
      title={label}
    >
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}

function CanvasHeader({
  design,
  nav,
  selected,
  onSelect,
}: {
  design: SiteDesign;
  nav: NavItem[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <header
      className={`${styles.storeHeader} ${selected === "menu" ? styles.selection : ""}`}
      onClick={() => onSelect("menu")}
    >
      <button
        type="button"
        className={`${styles.canvasLogo} ${selected === "brand" ? styles.selection : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("brand");
        }}
        title={design.logoUrl ? "Лого" : "Логото е изтрито"}
      >
        {design.logoUrl ? <img src={design.logoUrl} alt="Лого" /> : <span className={styles.deletedLogoPlaceholder}>Без лого</span>}
      </button>
      <nav>
        {nav.filter((item) => item.visible).map((item) => (
          <span key={`${item.href}-${item.label}`}>{item.label}</span>
        ))}
      </nav>
      <div className={styles.headerIcons}>♡　◎　▢</div>
    </header>
  );
}

function CanvasHero({
  page,
  selected,
  onSelect,
  onChange,
}: {
  page: EditablePageContent;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (patch: Partial<EditablePageContent>) => void;
}) {
  return (
    <section className={styles.hero}>
      <div
        className={`${styles.heroCopy} ${selected === "page" ? styles.selection : ""}`}
        onClick={() => onSelect("page")}
      >
        <small
          contentEditable={selected === "page"}
          suppressContentEditableWarning
          onBlur={(event) => onChange({ eyebrow: event.currentTarget.textContent || "" })}
        >
          {page.eyebrow}
        </small>
        <h1
          contentEditable={selected === "page"}
          suppressContentEditableWarning
          onBlur={(event) => onChange({ title: event.currentTarget.textContent || "" })}
        >
          {page.title}
        </h1>
        <p
          contentEditable={selected === "page"}
          suppressContentEditableWarning
          onBlur={(event) => onChange({ description: event.currentTarget.textContent || "" })}
        >
          {page.description}
        </p>
        {page.buttonText && (
          <button
            type="button"
            contentEditable={selected === "page"}
            suppressContentEditableWarning
            onBlur={(event) => onChange({ buttonText: event.currentTarget.textContent || "" })}
          >
            {page.buttonText}
          </button>
        )}
      </div>
      <button
        type="button"
        className={`${styles.heroImage} ${selected === "image" ? styles.selection : ""}`}
        onClick={() => onSelect("image")}
        style={{ backgroundImage: `url(${page.imageUrl || ""})` }}
        aria-label="Редактирай изображението"
      >
        {!page.imageUrl && <span>Натисни, за да добавиш снимка</span>}
      </button>
    </section>
  );
}

function CanvasFooter({
  design,
  selected,
  onSelect,
}: {
  design: SiteDesign;
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <footer
      className={`${styles.storeFooter} ${selected === "footer" ? styles.selection : ""}`}
      onClick={() => onSelect("footer")}
    >
      <div>{design.footerCopyright}</div>
    </footer>
  );
}

function Inspector({
  selected,
  design,
  page,
  pageKey,
  capabilities,
  nav,
  catalogSections,
  pageLinkOptions,
  refreshCatalogSections,
  set,
  setPage,
  setNav,
  fileRef,
  heroImages,
  chooseHeroImage,
  changeHeroImageUrl,
  removeHeroImage,
  device,
  universalTextEntries,
  universalTextOverrides,
  updateUniversalText,
  focusUniversalText,
}: {
  selected: Selection;
  design: SiteDesign;
  page: EditablePageContent;
  pageKey: EditablePageKey;
  capabilities: { text: boolean; button: boolean; image: boolean };
  nav: NavItem[];
  catalogSections: CatalogSectionEditorItem[];
  pageLinkOptions: PageLinkOption[];
  refreshCatalogSections: () => Promise<void>;
  set: <K extends keyof SiteDesign>(key: K, value: SiteDesign[K]) => void;
  setPage: (patch: Partial<EditablePageContent>) => void;
  setNav: (items: NavItem[]) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  heroImages: string[];
  chooseHeroImage: (slot: number) => void;
  changeHeroImageUrl: (slot: number, value: string) => void;
  removeHeroImage: (slot: number) => void;
  device: Device;
  universalTextEntries: UniversalTextEntry[];
  universalTextOverrides: UniversalTextOverrides;
  updateUniversalText: (key: string, value: string) => void;
  focusUniversalText: (key: string) => void;
}) {
  const [universalTextSearch, setUniversalTextSearch] = useState("");
  const customHomeSections = parseCustomHomeSections(design.customSectionsJson);
  const homeAboutIndex = customHomeSections.findIndex((section) => section.type === "imageText");
  const homeAboutSection = homeAboutIndex >= 0 ? customHomeSections[homeAboutIndex] : {
    id: "home-about",
    type: "imageText" as const,
    enabled: true,
    title: "Историята на нашия бранд",
    text: "Добави собствен текст за тази секция.",
    buttonText: "Научи повече",
    buttonHref: "/about",
    imageUrl: "",
    alignment: "left" as const,
  };
  const setHomeAboutSection = (patch: Partial<typeof homeAboutSection>) => {
    const nextSection = { ...homeAboutSection, ...patch };
    const nextSections = [...customHomeSections];
    if (homeAboutIndex >= 0) nextSections[homeAboutIndex] = nextSection;
    else nextSections.push(nextSection);
    set("customSectionsJson", JSON.stringify(nextSections));
  };


  if (selected === "brand") {
    return (
      <InspectorPanel icon="Z" title="Лого, име и типография" subtitle="Всички реално използвани настройки на идентичността са събрани тук.">
        <InspectorGroup title="Основно лого" description="Логото, което се използва в светлата тема и в основната навигация." defaultOpen>
          <ImagePreview url={design.logoUrl} label="Текущо основно лого" />
          <button type="button" className={styles.replaceButton} onClick={() => fileRef.current?.click()}>
            <span>＋</span>
            <div><strong>Смени логото</strong><small>PNG, JPG, WEBP или SVG</small></div>
          </button>
          <button
            type="button"
            className={styles.removeImageButton}
            onClick={() => {
              if (window.confirm("Да изтрия ли основното лого от дизайна?")) {
                set("logoUrl", "");
                set("darkLogoUrl", "");
              }
            }}
            disabled={!design.logoUrl}
          >
            Изтрий логото
          </button>
          <Field label="Адрес на основното лого" value={design.logoUrl} onChange={(value) => set("logoUrl", value)} />
          <Field label="Адрес на лого за тъмна тема" value={design.darkLogoUrl} onChange={(value) => set("darkLogoUrl", value)} />
          <label className={styles.rangeField}>
            <span>Размер на логото: {getLogoSize(design)}px</span>
            <input
              type="range"
              min="40"
              max="330"
              step="2"
              value={getLogoSize(design)}
              onChange={(event) => set("designTokensJson", withLogoSize(design, Number(event.target.value)))}
            />
          </label>
          <small className={styles.fieldHint}>Промяната се вижда веднага в реалния преглед и се записва с дизайна.</small>
        </InspectorGroup>
        <InspectorGroup title="Favicon" description="Иконата, която браузърът показва в таба и отметките.">
          <ImagePreview url={design.faviconUrl || ""} label="Текущ favicon" />
          <Field label="Адрес на favicon" value={design.faviconUrl || ""} onChange={(value) => set("faviconUrl", value || null)} />
          <small className={styles.fieldHint}>При празна стойност се използва неутралната икона на шаблона.</small>
        </InspectorGroup>
        {device === "mobile" && (
          <InspectorGroup title="Мобилно лого" description="Отделен размер само за телефон. Не променя desktop версията." defaultOpen>
            <label className={styles.rangeField}>
              <span>Ширина на мобилното лого: {getNumericToken(design, "responsive.mobile.logoImageWidth", 150)}px</span>
              <input type="range" min="70" max="260" step="2" value={getNumericToken(design, "responsive.mobile.logoImageWidth", 150)} onChange={(event) => set("designTokensJson", withNumericToken(design, "responsive.mobile.logoImageWidth", Number(event.target.value), "px"))} />
            </label>
          </InspectorGroup>
        )}
        <InspectorGroup title="Име на магазина" description="Текстовата идентичност, която се използва в сайта и администрацията." defaultOpen>
          <Field label="Име на магазина" value={design.brandName} onChange={(value) => set("brandName", value)} />
          <Field label="Кратък надпис" value={design.tagline} onChange={(value) => set("tagline", value)} />
        </InspectorGroup>
        <InspectorGroup title="Телефон в горната лента" description="Един и същ телефон се използва в горната лента и на страницата „Контакти“." defaultOpen>
          <Field label="Основен телефон" value={getPrimaryContactPhone(design)} onChange={(value) => set("designTokensJson", withPrimaryContactPhone(design, value))} />
          <small className={styles.fieldHint}>Промяната се вижда в header-а и в контактната информация след записване/публикуване.</small>
        </InspectorGroup>
      </InspectorPanel>
    );
  }

  if (selected === "image" && capabilities.image) {
    if (pageKey === "home") {
      return (
        <InspectorPanel icon="▧" title="Слайдшоу изображения" subtitle="Качи до 4 снимки. Те се сменят автоматично на всеки 3 секунди.">
          <div className={styles.slideshowNotice}>
            <strong>{heroImages.length}/4 снимки</strong>
            <small>Първата снимка е началната. Стрелките и точките работят автоматично в сайта.</small>
          </div>
          <div className={styles.heroImageList}>
            {Array.from({ length: Math.min(4, Math.max(1, heroImages.length + (heroImages.length < 4 ? 1 : 0))) }, (_, slot) => {
              const url = heroImages[slot] || "";
              return (
                <section className={styles.heroImageCard} key={slot}>
                  <div className={styles.heroImageCardHeader}>
                    <strong>Снимка {slot + 1}{slot === 0 ? " · Основна" : ""}</strong>
                    {url && <button type="button" onClick={() => removeHeroImage(slot)}>Премахни</button>}
                  </div>
                  <div className={styles.heroImageThumb}>
                    {url ? <img src={url} alt={`Слайд ${slot + 1}`} /> : <span>Свободно място за снимка</span>}
                  </div>
                  <button type="button" className={styles.replaceButton} onClick={() => chooseHeroImage(slot)}>
                    <span>＋</span>
                    <div><strong>{url ? "Смени снимката" : "Качи снимка"}</strong><small>PNG, JPG или WEBP</small></div>
                  </button>
                  <Field label={`Адрес на снимка ${slot + 1}`} value={url} onChange={(value) => changeHeroImageUrl(slot, value)} />
                </section>
              );
            })}
          </div>
        </InspectorPanel>
      );
    }
    if (pageKey === "about") {
      return (
        <InspectorPanel icon="▧" title="Изображение на „За нас“" subtitle="Смени декоративното лого вдясно, скрий го или върни оригиналния знак.">
          <InspectorGroup title="Показване" description="Изображението може да бъде скрито, без да се изтрива записаният адрес." defaultOpen>
            <ToggleField label="Показвай изображението" checked={page.imageVisible} onChange={(value) => setPage({ imageVisible: value })} />
          </InspectorGroup>
          <InspectorGroup title="Изображение" description="Качи PNG, JPG, WEBP или SVG. Препоръчително е изображение с прозрачен фон." defaultOpen>
            <ImagePreview url={page.imageUrl} label={page.imageUrl ? "Текущо изображение" : "Използва се оригиналният знак 3&3"} />
            <button type="button" className={styles.replaceButton} onClick={() => fileRef.current?.click()}>
              <span>＋</span>
              <div><strong>{page.imageUrl ? "Смени изображението" : "Качи изображение"}</strong><small>PNG, JPG, WEBP или SVG</small></div>
            </button>
            {page.imageUrl && (
              <button type="button" className={styles.removeImageButton} onClick={() => setPage({ imageUrl: "" })}>
                Върни оригиналния знак 3&3
              </button>
            )}
            <Field label="Адрес на изображението" value={page.imageUrl} onChange={(value) => setPage({ imageUrl: value })} />
          </InspectorGroup>
        </InspectorPanel>
      );
    }
    return (
      <InspectorPanel icon="▧" title="Изображение" subtitle="Подмени снимката и виж резултата веднага.">
        <ImagePreview url={page.imageUrl} label="Снимка на страницата" />
        <button type="button" className={styles.replaceButton} onClick={() => fileRef.current?.click()}>
          <span>＋</span>
          <div><strong>Избери нова снимка</strong><small>От твоя компютър</small></div>
        </button>
        <Divider />
        <Field label="Адрес на изображението" value={page.imageUrl} onChange={(value) => setPage({ imageUrl: value })} />
      </InspectorPanel>
    );
  }

  if (selected === "colors") {
    return (
      <InspectorPanel icon="◉" title="Глобални цветове и оформление" subtitle="Пълната палитра и всички глобални визуални настройки на сайта.">
        <div className={styles.livePreviewNotice}>
          <span aria-hidden="true" />
          <div><strong>Преглед в реално време</strong><small>Промените се виждат веднага. „Запиши“ ги съхранява за реалния магазин.</small></div>
        </div>
        <InspectorGroup title="Основна палитра" description="Основният цвят управлява навигацията, бутоните, секциите и администрацията." defaultOpen>
          <ColorField label="Основен цвят" value={design.primaryColor} onChange={(value) => set("primaryColor", value)} />
          <ColorField label="Акцент" value={design.secondaryColor} onChange={(value) => set("secondaryColor", value)} />
        </InspectorGroup>
        <InspectorGroup title="Светла тема" description="Фон, повърхности и текст в светъл режим." defaultOpen>
          <ColorField label="Фон" value={design.lightBackground} onChange={(value) => set("lightBackground", value)} />
          <ColorField label="Повърхност" value={design.lightSurface} onChange={(value) => set("lightSurface", value)} />
          <ColorField label="Текст" value={design.lightText} onChange={(value) => set("lightText", value)} />
        </InspectorGroup>
        <InspectorGroup title="Тъмна тема" description="Фон, повърхности и текст в тъмен режим.">
          <ColorField label="Тъмен фон" value={design.darkBackground} onChange={(value) => set("darkBackground", value)} />
          <ColorField label="Тъмна повърхност" value={design.darkSurface} onChange={(value) => set("darkSurface", value)} />
          <ColorField label="Тъмен текст" value={design.darkText} onChange={(value) => set("darkText", value)} />
        </InspectorGroup>
        <InspectorGroup title="Форма и изглед" description="Общо заобляне и реално използваните варианти на секциите.">
          <label className={styles.rangeField}>
            <span>Заобляне: {design.borderRadius}px</span>
            <input type="range" min="0" max="48" value={design.borderRadius} onChange={(event) => set("borderRadius", Number(event.target.value))} />
          </label>
          <SelectField label="Вариант на началния банер" value={design.heroVariant} onChange={(value) => set("heroVariant", value)} options={[{value:"classic",label:"Класически"},{value:"split",label:"Разделен"},{value:"minimal",label:"Минимален"}]} />
          <SelectField label="Вариант на категориите" value={design.categoriesVariant} onChange={(value) => set("categoriesVariant", value)} options={[{value:"overlay",label:"С текст върху снимката"},{value:"cards",label:"Карти"},{value:"minimal",label:"Минимален"}]} />
          <SelectField label="Вариант на продуктите" value={design.productsVariant} onChange={(value) => set("productsVariant", value)} options={[{value:"grid",label:"Решетка"},{value:"carousel",label:"Карусел"},{value:"compact",label:"Компактен"}]} />
        </InspectorGroup>
        {(device === "mobile" || device === "tablet") && (
          <InspectorGroup title={device === "mobile" ? "Мобилно оформление" : "Таблет оформление"} description="Тези настройки важат само за избраното устройство и не развалят desktop изгледа." defaultOpen>
            <label className={styles.rangeField}>
              <span>Мащаб на текста: {Math.round(getNumericToken(design, device === "mobile" ? "typography.scale.mobile" : "typography.scale.tablet", device === "mobile" ? 0.72 : 0.88) * 100)}%</span>
              <input type="range" min="55" max="110" step="1" value={getNumericToken(design, device === "mobile" ? "typography.scale.mobile" : "typography.scale.tablet", device === "mobile" ? 0.72 : 0.88) * 100} onChange={(event) => set("designTokensJson", withNumericToken(design, device === "mobile" ? "typography.scale.mobile" : "typography.scale.tablet", Number(event.target.value) / 100))} />
            </label>
            {device === "mobile" && <>
              <label className={styles.rangeField}>
                <span>Странични отстояния: {getNumericToken(design, "responsive.mobile.horizontalPadding", 16)}px</span>
                <input type="range" min="8" max="32" step="1" value={getNumericToken(design, "responsive.mobile.horizontalPadding", 16)} onChange={(event) => set("designTokensJson", withNumericToken(design, "responsive.mobile.horizontalPadding", Number(event.target.value), "px"))} />
              </label>
              <label className={styles.rangeField}>
                <span>Височина на началния банер: {getNumericToken(design, "responsive.mobile.heroMinHeight", 520)}px</span>
                <input type="range" min="360" max="760" step="10" value={getNumericToken(design, "responsive.mobile.heroMinHeight", 520)} onChange={(event) => set("designTokensJson", withNumericToken(design, "responsive.mobile.heroMinHeight", Number(event.target.value), "px"))} />
              </label>
              <SelectField label="Продукти на ред" value={String(Math.round(getNumericToken(design, "responsive.mobile.productColumns", 1)))} onChange={(value) => set("designTokensJson", withNumericToken(design, "responsive.mobile.productColumns", Number(value)))} options={[{value:"1",label:"1 продукт на ред"},{value:"2",label:"2 продукта на ред"}]} />
            </>}
          </InspectorGroup>
        )}
        <InspectorGroup title="Секции на началната страница" description="Показвай само секциите, които действително са необходими.">
          <ToggleField label="Начален банер" checked={design.showHero} onChange={(value) => set("showHero", value)} />
          <ToggleField label="Предимства" checked={design.showBenefits} onChange={(value) => set("showBenefits", value)} />
          <ToggleField label="Категории" checked={design.showCategories} onChange={(value) => set("showCategories", value)} />
          <ToggleField label="Продукти" checked={design.showProducts} onChange={(value) => set("showProducts", value)} />
        </InspectorGroup>
      </InspectorPanel>
    );
  }


  if (selected === "sections") {
    const createSection = async () => {
      const name = window.prompt("Име на новата секция/страница, например Обувки");
      if (!name?.trim()) return;
      const slug = window.prompt("URL път без наклонена черта, например obuvki", name.toLowerCase().replace(/[^a-z0-9а-я]+/gi, "-"));
      const response = await fetch("/api/admin/catalog-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug || name, eyebrow: name.trim().toUpperCase(), description: "" }),
      });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Секцията не беше създадена."); return; }
      await refreshCatalogSections();
      setNav([...nav, { label: result.section.name, href: `/${result.section.slug}`, visible: true, openInNewTab: false }]);
    };

    const updateSection = async (section: CatalogSectionEditorItem, patch: Partial<CatalogSectionEditorItem>) => {
      const response = await fetch(`/api/admin/catalog-sections/${section.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Секцията не беше обновена."); return; }
      await refreshCatalogSections();
    };

    const removeSection = async (section: CatalogSectionEditorItem) => {
      if (!confirm(`Да премахна секция „${section.name}“?`)) return;
      const response = await fetch(`/api/admin/catalog-sections/${section.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Секцията не беше премахната."); return; }
      await refreshCatalogSections();
      setNav(nav.map((item) => item.href === `/${section.slug}` ? { ...item, visible: false } : item));
    };

    return (
      <InspectorPanel icon="▥" title="Секции / страници" subtitle="Секцията е самостоятелна страница на магазина. Категориите са отделни филтри.">
        <div className={styles.livePreviewNotice}>
          <span aria-hidden="true" />
          <div>
            <strong>Нова логика</strong>
            <small>Създаваш секция/страница тук. Тя не се връзва към основна група. Категориите се управляват отделно от Админ → Магазин → Категории.</small>
          </div>
        </div>
        <button type="button" className={styles.addMenuButton} onClick={createSection}>+ Създай секция/страница</button>
        <div className={styles.menuList}>
          {catalogSections.map((section) => (
            <div className={styles.menuCard} key={section.id}>
              <div className={styles.menuCardTop}>
                <strong>{section.name}</strong>
                <small>/{section.slug}</small>
              </div>
              <Field label="Име" value={section.name} onChange={(value) => updateSection(section, { name: value })} />
              <Field label="Път" value={section.slug} onChange={(value) => updateSection(section, { slug: value })} />
              <Field label="Описание" value={section.description} onChange={(value) => updateSection(section, { description: value })} area />
              <ToggleField label="Активна секция" checked={section.isActive} onChange={(value) => updateSection(section, { isActive: value })} />
              <button type="button" className={styles.deleteButton} onClick={() => removeSection(section)} disabled={section.isSystem}>Изтрий секцията</button>
            </div>
          ))}
        </div>
      </InspectorPanel>
    );
  }

  if (selected === "menu") {
    const updateItem = (index: number, patch: Partial<NavItem>) => {
      const next = [...nav];
      next[index] = { ...next[index], ...patch };
      setNav(next);
    };

    const moveItem = (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= nav.length) return;
      const next = [...nav];
      [next[index], next[target]] = [next[target], next[index]];
      setNav(next);
    };

    const addItem = () => {
      setNav([
        ...nav,
        {
          href: "/",
          label: `Нов бутон ${nav.length + 1}`,
          visible: true,
          openInNewTab: false,
        },
      ]);
    };

    const removeItem = (index: number) => {
      const item = nav[index];
      const label = item?.label?.trim() || `Бутон ${index + 1}`;
      if (!window.confirm(`Да изтрия ли бутона „${label}“ от менюто?`)) return;
      setNav(nav.filter((_, itemIndex) => itemIndex !== index));
    };

    return (
      <InspectorPanel icon="☰" title="Главно меню" subtitle="Управлявай бутоните, видимостта, подредбата и връзките им.">
        <div className={styles.livePreviewNotice}>
          <span aria-hidden="true" />
          <div>
            <strong>Пълен контрол над навигацията</strong>
            <small>Скритите бутони остават записани и могат да бъдат показани отново по всяко време.</small>
          </div>
        </div>
        <button type="button" className={styles.addMenuButton} onClick={addItem}>+ Добави бутон</button>
        <div className={styles.menuList}>
          {nav.map((item, index) => (
            <div className={styles.menuCard} key={`${index}-${item.href}-${item.label}`}>
              <div className={styles.menuCardTop}>
                <strong>Бутон {index + 1}</strong>
                <div className={styles.menuOrderActions}>
                  <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Премести нагоре">↑</button>
                  <button type="button" onClick={() => moveItem(index, 1)} disabled={index === nav.length - 1} aria-label="Премести надолу">↓</button>
                  <button type="button" className={styles.menuDeleteButton} onClick={() => removeItem(index)} aria-label="Изтрий бутона">×</button>
                </div>
              </div>
              <ToggleField label="Показвай бутона" checked={item.visible !== false} onChange={(value) => updateItem(index, { visible: value })} />
              <Field label="Име" value={item.label} onChange={(value) => updateItem(index, { label: value })} />
              <PageLinkField
                label="Към коя страница води"
                value={item.href}
                onChange={(value) => updateItem(index, { href: value })}
                options={pageLinkOptions}
              />
              <ToggleField label="Отваряй в нов раздел" checked={Boolean(item.openInNewTab)} onChange={(value) => updateItem(index, { openInNewTab: value })} />
            </div>
          ))}
        </div>
      </InspectorPanel>
    );
  }

  if (selected === "footer") {
    return (
      <InspectorPanel icon="▤" title="Долна част" subtitle="Пълните настройки на footer-а, включително колони и социални връзки.">
        <InspectorGroup title="Информация и колони" description="Текстът за магазина и заглавията на footer колоните." defaultOpen>
          <Field label="Текст за магазина" value={design.footerAbout} onChange={(value) => set("footerAbout", value)} area />
          <Field label="Заглавие „Пазарувай“" value={design.footerShopTitle} onChange={(value) => set("footerShopTitle", value)} />
          <Field label="Заглавие „Помощ“" value={design.footerHelpTitle} onChange={(value) => set("footerHelpTitle", value)} />
          <Field label="Заглавие „Последвай ни“" value={design.footerSocialTitle} onChange={(value) => set("footerSocialTitle", value)} />
          <Field label="Авторски права" value={design.footerCopyright} onChange={(value) => set("footerCopyright", value)} />
        </InspectorGroup>
        <InspectorGroup title="Социални мрежи" description="Празните адреси не се показват в сайта.">
          <Field label="Instagram" value={design.instagramUrl} onChange={(value) => set("instagramUrl", value)} />
          <Field label="Facebook" value={design.facebookUrl} onChange={(value) => set("facebookUrl", value)} />
          <Field label="TikTok" value={design.tiktokUrl} onChange={(value) => set("tiktokUrl", value)} />
        </InspectorGroup>
      </InspectorPanel>
    );
  }

  if (!capabilities.text) {
    return (
      <InspectorPanel icon="✓" title="Няма настройки за съдържание" subtitle="Тази страница използва собствен функционален екран.">
        <div className={styles.livePreviewNotice}>
          <span aria-hidden="true" />
          <div>
            <strong>Няма излишни полета</strong>
            <small>Текстът и бутоните на тази страница не се управляват от този панел, затова опциите са скрити.</small>
          </div>
        </div>
      </InspectorPanel>
    );
  }

  if (page === undefined) return null;

  const universalQuery = universalTextSearch.trim().toLocaleLowerCase("bg");
  const filteredUniversalTexts = universalTextEntries.filter((entry) =>
    !universalQuery ||
    entry.text.toLocaleLowerCase("bg").includes(universalQuery) ||
    entry.context.toLocaleLowerCase("bg").includes(universalQuery)
  );

  const pageTextFields = (
    <InspectorGroup title="Основно съдържание" description="Текстовете, които реално се показват на избраната страница." defaultOpen>
      <Field label="Малък надпис" value={page.eyebrow} onChange={(value) => setPage({ eyebrow: value })} />
      <Field label="Главно заглавие" value={page.title} onChange={(value) => setPage({ title: value })} />
      <Field label="Описание" value={page.description} onChange={(value) => setPage({ description: value })} area />
      {capabilities.button && (
        <>
          <Field label="Текст на бутона" value={page.buttonText} onChange={(value) => setPage({ buttonText: value })} />
          <PageLinkField label="Страница на бутона" value={page.buttonHref} onChange={(value) => setPage({ buttonHref: value })} options={pageLinkOptions} />
        </>
      )}
    </InspectorGroup>
  );

  return (
    <InspectorPanel
      icon="T"
      title={page === undefined ? "Текст" : capabilities.button ? "Текст и бутон" : "Текст"}
      subtitle={pageKey === "home" ? "Пълните текстови настройки на началната страница." : capabilities.button ? "Редактирай текста и реалния бутон на тази страница." : "Показани са всички текстове, които тази страница използва."}
    >
      {pageTextFields}
      <InspectorGroup
        title="Глобални контактни данни"
        description="Телефонът, имейлът, работното време и адресът се използват на различни места в сайта и могат да се редактират от всяка страница."
        defaultOpen
      >
        <Field label="Основен телефон" value={getPrimaryContactPhone(design)} onChange={(value) => set("designTokensJson", withPrimaryContactPhone(design, value))} />
        <Field label="Допълнителен телефон" value={getContactContentValue(design, "secondaryPhone")} onChange={(value) => set("designTokensJson", withContactContentValue(design, "secondaryPhone", value))} />
        <Field label="Основен имейл" value={getContactContentValue(design, "email")} onChange={(value) => set("designTokensJson", withContactContentValue(design, "email", value))} />
        <Field label="Работно време" value={getContactContentValue(design, "workingHours")} onChange={(value) => set("designTokensJson", withContactContentValue(design, "workingHours", value))} />
        <Field label="Адрес / обслужване" value={getContactContentValue(design, "address")} onChange={(value) => set("designTokensJson", withContactContentValue(design, "address", value))} area />
      </InspectorGroup>
      <InspectorGroup
        title={`Всички останали текстове (${universalTextEntries.length})`}
        description="Всички видими текстове от реалната страница са събрани тук, в същата секция „Текст“."
        defaultOpen
      >
        <Field label="Търси текст" value={universalTextSearch} onChange={setUniversalTextSearch} />
        <div className={styles.universalTextList}>
          {filteredUniversalTexts.map((entry) => (
            <div className={styles.universalTextItem} key={entry.key}>
              <button type="button" className={styles.universalTextLocate} onClick={() => focusUniversalText(entry.key)} title="Покажи текста в прегледа">⌖</button>
              <div>
                <small>{entry.context} · {entry.tag}</small>
                <textarea
                  value={universalTextOverrides[entry.key] ?? entry.text}
                  onChange={(event) => updateUniversalText(entry.key, event.target.value)}
                  rows={Math.min(5, Math.max(2, Math.ceil((universalTextOverrides[entry.key] ?? entry.text).length / 42)))}
                />
                {universalTextOverrides[entry.key] !== undefined && (
                  <button type="button" className={styles.universalTextReset} onClick={() => updateUniversalText(entry.key, "")}>
                    Върни оригиналния текст
                  </button>
                )}
              </div>
            </div>
          ))}
          {!filteredUniversalTexts.length && <p className={styles.universalTextEmpty}>Няма текстове, които отговарят на търсенето.</p>}
        </div>
      </InspectorGroup>
      {pageKey === "contact" && (
        <>
          <InspectorGroup title="Форма и секция с контакти" description="Всички заглавия и пояснения над формата и контактните карти.">
            {([
              ["formTitle", "Заглавие над формата"], ["formDescription", "Пояснение над формата"],
              ["infoTitle", "Заглавие на контактната секция"], ["infoDescription", "Пояснение на контактната секция"],
              ["phoneTitle", "Заглавие на телефона"], ["phoneDescription", "Описание под телефона"],
              ["emailTitle", "Заглавие на имейла"], ["emailDescription", "Описание под имейла"],
              ["hoursTitle", "Заглавие на работното време"], ["hoursDescription", "Описание под работното време"],
              ["addressTitle", "Заглавие на адреса"], ["addressDescription", "Описание под адреса"],
            ] as [ContactContentKey, string][]).map(([key, label]) => <Field key={key} label={label} value={getContactContentValue(design, key)} onChange={(value) => set("designTokensJson", withContactContentValue(design, key, value))} area={key.toLowerCase().includes("description")} />)}
          </InspectorGroup>
          <InspectorGroup title="Полезна информация" description="Трите информационни блока в долната част на страницата.">
            {([
              ["quick1Eyebrow", "Блок 1 — малък надпис"], ["quick1Title", "Блок 1 — заглавие"], ["quick1Text", "Блок 1 — текст"],
              ["quick2Eyebrow", "Блок 2 — малък надпис"], ["quick2Title", "Блок 2 — заглавие"], ["quick2Text", "Блок 2 — текст"],
              ["quick3Eyebrow", "Блок 3 — малък надпис"], ["quick3Title", "Блок 3 — заглавие"], ["quick3Text", "Блок 3 — текст"],
            ] as [ContactContentKey, string][]).map(([key, label]) => <Field key={key} label={label} value={getContactContentValue(design, key)} onChange={(value) => set("designTokensJson", withContactContentValue(design, key, value))} area={key.endsWith("Text")} />)}
          </InspectorGroup>
        </>
      )}
      {pageKey === "home" && (
        <>
          <InspectorGroup title="Предимства" description="Четирите информационни полета под началния банер.">
            <Field label="Предимство 1 — заглавие" value={design.benefitsTitle1} onChange={(value) => set("benefitsTitle1", value)} />
            <Field label="Предимство 1 — текст" value={design.benefitsText1} onChange={(value) => set("benefitsText1", value)} />
            <Field label="Предимство 2 — заглавие" value={design.benefitsTitle2} onChange={(value) => set("benefitsTitle2", value)} />
            <Field label="Предимство 2 — текст" value={design.benefitsText2} onChange={(value) => set("benefitsText2", value)} />
            <Field label="Предимство 3 — заглавие" value={design.benefitsTitle3} onChange={(value) => set("benefitsTitle3", value)} />
            <Field label="Предимство 3 — текст" value={design.benefitsText3} onChange={(value) => set("benefitsText3", value)} />
            <Field label="Предимство 4 — заглавие" value={design.benefitsTitle4} onChange={(value) => set("benefitsTitle4", value)} />
            <Field label="Предимство 4 — текст" value={design.benefitsText4} onChange={(value) => set("benefitsText4", value)} />
          </InspectorGroup>
          <InspectorGroup title="Категории" description="Заглавието и текстовете на трите категории.">
            <Field label="Заглавие на секцията" value={design.categoriesTitle} onChange={(value) => set("categoriesTitle", value)} />
            <Field label="Дамско — заглавие" value={design.womenTitle} onChange={(value) => set("womenTitle", value)} />
            <Field label="Дамско — описание" value={design.womenDescription} onChange={(value) => set("womenDescription", value)} />
            <Field label="Мъжко — заглавие" value={design.menTitle} onChange={(value) => set("menTitle", value)} />
            <Field label="Мъжко — описание" value={design.menDescription} onChange={(value) => set("menDescription", value)} />
            <Field label="Детско — заглавие" value={design.kidsTitle} onChange={(value) => set("kidsTitle", value)} />
            <Field label="Детско — описание" value={design.kidsDescription} onChange={(value) => set("kidsDescription", value)} />
            <Field label="Текст на бутоните" value={design.categoryButtonText} onChange={(value) => set("categoryButtonText", value)} />
          </InspectorGroup>
          <InspectorGroup title="За нас" description="Секцията „За нас“ на началната страница и бутонът към избрана страница." defaultOpen>
            <ToggleField label="Показвай секцията „За нас“" checked={homeAboutSection.enabled} onChange={(value) => setHomeAboutSection({ enabled: value })} />
            <Field label="Заглавие" value={homeAboutSection.title} onChange={(value) => setHomeAboutSection({ title: value })} />
            <Field label="Текст" value={homeAboutSection.text} onChange={(value) => setHomeAboutSection({ text: value })} area />
            <Field label="Текст на бутона" value={homeAboutSection.buttonText} onChange={(value) => setHomeAboutSection({ buttonText: value })} />
            <PageLinkField label="Страница на бутона" value={homeAboutSection.buttonHref} onChange={(value) => setHomeAboutSection({ buttonHref: value })} options={pageLinkOptions} />
          </InspectorGroup>
          <InspectorGroup title="Продукти" description="Заглавието и връзката на секцията с нови продукти.">
            <Field label="Заглавие на продуктите" value={design.productsTitle} onChange={(value) => set("productsTitle", value)} />
            <Field label="Текст на връзката" value={design.productsLinkText} onChange={(value) => set("productsLinkText", value)} />
          </InspectorGroup>
        </>
      )}
    </InspectorPanel>
  );
}

function InspectorGroup({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className={styles.inspectorGroup} open={defaultOpen}>
      <summary>
        <div><strong>{title}</strong>{description && <small>{description}</small>}</div>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.inspectorGroupBody}>{children}</div>
    </details>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ToggleField({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.toggleField}>
      <span>{label}</span>
      <span className={styles.switch}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </span>
    </label>
  );
}

function InspectorPanel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.inspectorPanel}>
      <div className={styles.inspectorHeader}>
        <span>{icon}</span>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  area = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  help?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {area ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.colorField}>
      <span>{label}</span>
      <div>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function ImagePreview({ url, label }: { url: string; label: string }) {
  return (
    <div className={styles.imageCard}>
      <div className={styles.imagePreview}>
        {url ? <img src={url} alt={label} /> : <span>Няма избрано изображение</span>}
      </div>
      <div><strong>{label}</strong><small>{url ? "Изображението е заредено" : "Добави изображение"}</small></div>
    </div>
  );
}

function Divider() {
  return <div className={styles.divider}><span>или използвай адрес</span></div>;
}
