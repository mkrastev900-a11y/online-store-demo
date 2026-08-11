/* eslint-disable @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
export const ORIGINAL_PRIMARY_COLOR = "#5c0b2d";
export const ORIGINAL_SECONDARY_COLOR = "#cda64d";
export const ORIGINAL_LIGHT_BACKGROUND = "#fbf7f2";
export const ORIGINAL_LIGHT_SURFACE = "#fffdf9";
export const ORIGINAL_LIGHT_TEXT = "#21161b";

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

function normalizeHex(value: string, fallback = ORIGINAL_PRIMARY_COLOR) {
  const candidate = String(value || "").trim();
  return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback;
}

function hexToRgb(value: string) {
  const hex = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mixWithBlack(value: string, keep: number) {
  const { r, g, b } = hexToRgb(value);
  return rgbToHex(r * keep, g * keep, b * keep);
}

function rgba(value: string, alpha: number) {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type HeaderPalette = {
  headerStart: string;
  headerEnd: string;
  utility: string;
  navigation: string;
  search: string;
  mobileDrawer: string;
};

/**
 * Keeps the original three-layer luxury header structure. The original brand
 * colour reproduces the historical CSS values exactly; any other colour is
 * converted into matching fully opaque dark shades so live colour editing remains readable.
 * The search field and navigation bar intentionally use the exact same shade.
 */
export function deriveHeaderPalette(primaryColor: string): HeaderPalette {
  const primary = normalizeHex(primaryColor);
  if (primary === ORIGINAL_PRIMARY_COLOR) {
    return {
      headerStart: "#52051d",
      headerEnd: "#430316",
      utility: "#260008",
      search: "#3b0011",
      navigation: "#3b0011",
      mobileDrawer: "#430316",
    };
  }

  return {
    headerStart: mixWithBlack(primary, 0.9),
    headerEnd: mixWithBlack(primary, 0.72),
    utility: mixWithBlack(primary, 0.4),
    search: mixWithBlack(primary, 0.64),
    navigation: mixWithBlack(primary, 0.64),
    mobileDrawer: mixWithBlack(primary, 0.72),
  };
}
