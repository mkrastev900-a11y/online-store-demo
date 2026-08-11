import type { ComponentStyleDefinition } from "./types";

const definitions: ComponentStyleDefinition[] = [
  { key: "button", label: "Бутони", category: "forms", tokenKeys: ["color.primary", "color.primaryText", "radius.button", "shadow.button", "motion.fast"] },
  { key: "card", label: "Карти", category: "content", tokenKeys: ["color.surface", "color.border", "radius.card", "shadow.card", "motion.normal"] },
  { key: "input", label: "Полета и форми", category: "forms", tokenKeys: ["color.surface", "color.border", "color.text", "radius.input"] },
  { key: "header", label: "Навигация", category: "navigation", tokenKeys: ["color.surface", "color.text", "shadow.header"] },
  { key: "footer", label: "Footer", category: "navigation", tokenKeys: ["color.surface", "color.text", "color.muted"] },
  { key: "hero", label: "Hero", category: "content", tokenKeys: ["color.primary", "color.secondary", "radius.hero", "space.section"] },
  { key: "productCard", label: "Продуктова карта", category: "commerce", tokenKeys: ["color.surface", "color.border", "radius.card", "shadow.card"] },
  { key: "productGrid", label: "Продуктова мрежа", category: "commerce", tokenKeys: ["space.grid", "space.section"] },
  { key: "section", label: "Секция", category: "layout", tokenKeys: ["space.section", "layout.maxWidth"] },
];

export const COMPONENT_REGISTRY = Object.freeze(
  Object.fromEntries(definitions.map((definition) => [definition.key, Object.freeze(definition)])),
) as Readonly<Record<string, ComponentStyleDefinition>>;

export function getRegisteredComponent(key: string) {
  return COMPONENT_REGISTRY[key] ?? null;
}

export function listRegisteredComponents() {
  return Object.values(COMPONENT_REGISTRY);
}
