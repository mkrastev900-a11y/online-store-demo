"use client";

import { useEffect } from "react";

type TextOverrides = Record<string, string>;
type TextEntry = { key: string; text: string; tag: string; context: string };

function parseOverrides(designTokensJson: string): TextOverrides {
  try {
    const tokens = JSON.parse(designTokensJson || "{}");
    const raw = typeof tokens?.["content.textOverrides"] === "string" ? tokens["content.textOverrides"] : "{}";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string")) as TextOverrides;
  } catch {
    return {};
  }
}

const originalTextCache = new WeakMap<Element, string>();

function originalText(element: Element) {
  const cached = originalTextCache.get(element);
  if (cached !== undefined) return cached;

  const value = directText(element);
  originalTextCache.set(element, value);
  return value;
}

function directText(element: Element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectorPart(element: Element) {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
}

function elementKey(element: Element) {
  const root = document.querySelector("[data-storefront-root]") || document.body;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== root && parts.length < 12) {
    parts.unshift(selectorPart(current));
    current = current.parentElement;
  }
  return `${window.location.pathname}|${parts.join(">")}`;
}

function editableElements(): Element[] {
  const root = document.querySelector("[data-storefront-root]") || document.body;

  // Scan the parent element of every real visible text node instead of relying
  // on a small tag allow-list. This includes dt/dd, blockquote, div, em and any
  // future component markup without requiring another editor update.
  return Array.from(root.querySelectorAll("*")).filter((element) => {
    if (element.closest("[data-no-text-editor],script,style,noscript,svg,canvas,template")) return false;
    const text = directText(element);
    if (!text || text.length > 1000) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function editableTargetFromEvent(event: MouseEvent) {
  const editable = new Set(editableElements());
  for (const item of event.composedPath()) {
    if (item instanceof Element && editable.has(item)) return item as HTMLElement;
  }
  return null;
}


function caretOffsetAtClick(target: HTMLElement, clientX: number, clientY: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;
  const position = doc.caretPositionFromPoint?.(clientX, clientY);
  if (position && target.contains(position.offsetNode)) {
    node = position.offsetNode;
    offset = position.offset;
  } else {
    const range = doc.caretRangeFromPoint?.(clientX, clientY) || null;
    if (range && target.contains(range.startContainer)) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node) return directText(target).length;

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return Math.max(0, Math.min(total + offset, directText(target).length));
    total += current.textContent?.length || 0;
    current = walker.nextNode();
  }
  return directText(target).length;
}

function textBounds(target: HTMLElement) {
  const textNodes = Array.from(target.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim(),
  );
  if (textNodes.length) {
    const range = document.createRange();
    range.setStartBefore(textNodes[0]);
    range.setEndAfter(textNodes[textNodes.length - 1]);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return target.getBoundingClientRect();
}

function placeCaret(editor: HTMLElement, offset: number) {
  const node = editor.firstChild || editor.appendChild(document.createTextNode(""));
  const safeOffset = Math.max(0, Math.min(offset, node.textContent?.length || 0));
  const range = document.createRange();
  range.setStart(node, safeOffset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createInlineEditor(target: HTMLElement, value: string, caretOffset: number) {
  const rect = textBounds(target);
  const style = window.getComputedStyle(target);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.25 || 28;
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.textContent = value;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.setAttribute("aria-label", "Редактиране на текст");
  editor.dataset.zlateviInlineEditor = "true";

  const maxWidth = Math.max(90, window.innerWidth - Math.max(8, rect.left) - 12);
  Object.assign(editor.style, {
    position: "fixed",
    left: `${Math.max(4, rect.left)}px`,
    top: `${Math.max(4, rect.top)}px`,
    width: `${Math.min(Math.max(rect.width, 70), maxWidth)}px`,
    minHeight: `${Math.max(rect.height, lineHeight)}px`,
    maxHeight: `${Math.max(100, window.innerHeight - Math.max(8, rect.top) - 16)}px`,
    zIndex: "2147483647",
    boxSizing: "border-box",
    margin: "0",
    padding: "0",
    border: "1px dashed rgba(212, 167, 44, .72)",
    borderRadius: style.borderRadius === "0px" ? "2px" : style.borderRadius,
    outline: "none",
    overflow: "auto",
    background: "transparent",
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    boxShadow: "none",
    caretColor: style.color,
  });

  document.body.appendChild(editor);
  editor.focus({ preventScroll: true });
  placeCaret(editor, caretOffset);
  return editor;
}
function applyOverrides(overrides: TextOverrides) {
  for (const element of editableElements()) {
    const key = elementKey(element);
    // Ако няма изрично записан override, оставяме React да управлява текста.
    // Това е важно за динамични стойности като име на логнат потребител,
    // бройки в количката, статуси и други client state елементи.
    if (typeof overrides[key] !== "string") continue;
    const desired = overrides[key];
    if (directText(element) === desired) continue;
    const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    if (textNodes.length) {
      textNodes[0].textContent = desired;
      for (const node of textNodes.slice(1)) node.textContent = "";
    }
  }
}

function scan(): TextEntry[] {
  return editableElements().map((element) => ({
    key: elementKey(element),
    text: originalText(element),
    tag: element.tagName.toLowerCase(),
    context: (element.closest("header,main,footer,section,nav,article,form")?.tagName || "страница").toLowerCase(),
  }));
}

export default function UniversalTextOverrides({ designTokensJson }: { designTokensJson: string }) {
  useEffect(() => {
    let overrides = parseOverrides(designTokensJson);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let textEditingEnabled = false;
    let editingKey: string | null = null;
    const preview = new URLSearchParams(window.location.search).get("visualEditorPreview") === "1";

    const apply = () => {
      if (!editingKey) applyOverrides(overrides);
    };
    const sendScan = () => {
      if (!preview) return;
      window.parent.postMessage({ type: "zlatevi:text-editor-scan", pathname: window.location.pathname, entries: scan() }, window.location.origin);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { apply(); sendScan(); }, 80);
    };

    apply();
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "zlatevi:text-editor-request-scan") sendScan();
      if (event.data?.type === "zlatevi:text-overrides-preview" && event.data.overrides && typeof event.data.overrides === "object") {
        overrides = event.data.overrides as TextOverrides;
        apply();
        sendScan();
      }
      if (event.data?.type === "zlatevi:text-editor-mode") {
        textEditingEnabled = event.data.enabled === true;
        document.documentElement.dataset.zlateviTextEditing = textEditingEnabled ? "true" : "false";
      }
      if (event.data?.type === "zlatevi:text-editor-focus" && typeof event.data.key === "string") {
        const target = editableElements().find((element) => elementKey(element) === event.data.key) as HTMLElement | undefined;
        if (target) {
          const rect = target.getBoundingClientRect();
          const top = window.scrollY + rect.top - Math.max(24, (window.innerHeight - rect.height) / 2);
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          const oldOutline = target.style.outline;
          const oldOffset = target.style.outlineOffset;
          target.style.outline = "3px solid #d4a72c";
          target.style.outlineOffset = "4px";
          setTimeout(() => { target.style.outline = oldOutline; target.style.outlineOffset = oldOffset; }, 1600);
        }
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!preview || !textEditingEnabled) return;
      const target = editableTargetFromEvent(event);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      const key = elementKey(target);
      const before = directText(target);
      const caretOffset = caretOffsetAtClick(target, event.clientX, event.clientY);
      editingKey = key;
      target.dataset.zlateviInlineEditing = "true";
      const oldVisibility = target.style.visibility;
      target.style.visibility = "hidden";
      const editor = createInlineEditor(target, before, caretOffset);

      let finished = false;
      const finish = (commit: boolean) => {
        if (finished) return;
        finished = true;
        const value = (editor.textContent || "").replace(/\r\n/g, "\n").trim();
        editor.remove();
        target.style.visibility = oldVisibility;
        delete target.dataset.zlateviInlineEditing;
        editingKey = null;
        if (commit) {
          overrides[key] = value;
          applyOverrides(overrides);
          window.parent.postMessage({ type: "zlatevi:text-editor-inline-change", key, value }, window.location.origin);
        }
        schedule();
      };

      editor.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          finish(false);
        } else if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
          keyboardEvent.preventDefault();
          finish(true);
        }
      });
      editor.addEventListener("blur", () => finish(true), { once: true });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, [designTokensJson]);

  return null;
}
