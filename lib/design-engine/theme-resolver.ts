import { parseDesignTokenOverrides, type SiteDesign } from "@/lib/site-design";
import { COMPONENT_REGISTRY } from "./component-registry";
import type { ResolvedDesignTheme, ThemeTokenMap } from "./types";
import { deriveHeaderPalette } from "./header-palette";

function sanitizeCssValue(value: string) {
  return value.replace(/[\u0000-\u001f\u007f{};<>]/g, "").trim();
}

function px(value: number) {
  return `${Math.max(0, Math.round(value))}px`;
}

function scaledLength(value: unknown, scale: unknown) {
  const raw = String(value).trim();
  const factor = Number(scale);
  const match = raw.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match || !Number.isFinite(factor)) return raw;
  return `${Math.round(Number(match[1]) * factor * 100) / 100}px`;
}

export function resolveDesignTokens(design: SiteDesign): ThemeTokenMap {
  const radius = Math.max(0, design.borderRadius);

  const base: ThemeTokenMap = {
    "color.primary": sanitizeCssValue(design.primaryColor),
    "color.secondary": sanitizeCssValue(design.secondaryColor),
    "color.primaryText": "#ffffff",
    "color.light.background": sanitizeCssValue(design.lightBackground),
    "color.light.surface": sanitizeCssValue(design.lightSurface),
    "color.light.text": sanitizeCssValue(design.lightText),
    "color.light.muted": "color-mix(in srgb, var(--theme-text) 65%, transparent)",
    "color.light.border": "color-mix(in srgb, var(--theme-text) 16%, transparent)",
    "color.dark.background": sanitizeCssValue(design.darkBackground),
    "color.dark.surface": sanitizeCssValue(design.darkSurface),
    "color.dark.text": sanitizeCssValue(design.darkText),
    "color.dark.muted": "color-mix(in srgb, var(--theme-text) 68%, transparent)",
    "color.dark.border": "color-mix(in srgb, var(--theme-text) 20%, transparent)",
    "font.body": sanitizeCssValue(design.fontFamily),
    "font.heading": sanitizeCssValue(design.headingFontFamily),
    "typography.body.size": "16px",
    "typography.body.weight": 400,
    "typography.body.lineHeight": 1.65,
    "typography.body.letterSpacing": "0px",
    "typography.h1.size": "64px",
    "typography.h1.weight": 700,
    "typography.h1.lineHeight": 1.04,
    "typography.h1.letterSpacing": "-0.035em",
    "typography.h2.size": "44px",
    "typography.h2.weight": 700,
    "typography.h2.lineHeight": 1.12,
    "typography.h2.letterSpacing": "-0.025em",
    "typography.h3.size": "28px",
    "typography.h3.weight": 700,
    "typography.h3.lineHeight": 1.2,
    "typography.h3.letterSpacing": "-0.015em",
    "typography.small.size": "13px",
    "typography.small.weight": 500,
    "typography.small.lineHeight": 1.45,
    "typography.small.letterSpacing": "0.02em",
    "typography.scale.desktop": 1,
    "typography.scale.tablet": 0.88,
    "typography.scale.mobile": 0.72,
    "responsive.mobile.logoImageWidth": "150px",
    "responsive.mobile.horizontalPadding": "16px",
    "responsive.mobile.heroMinHeight": "520px",
    "responsive.mobile.productColumns": 1,
    "radius.base": px(radius),
    "radius.button": px(Math.max(8, Math.round(radius * 0.72))),
    "radius.input": px(Math.max(8, Math.round(radius * 0.62))),
    "radius.card": px(radius),
    "radius.hero": px(Math.round(radius * 1.35)),
    "shadow.button": "0 8px 22px color-mix(in srgb, var(--brand-primary) 22%, transparent)",
    "button.height": "48px",
    "button.paddingX": "24px",
    "button.borderWidth": "0px",
    "button.fontWeight": 700,
    "button.textTransform": "none",
    "button.hover": "lift",
    "button.primary.variant": "solid",
    "shadow.card": "0 18px 50px color-mix(in srgb, var(--theme-text) 9%, transparent)",
    "card.padding": "24px",
    "card.borderWidth": "1px",
    "card.imageRadius": "14px",
    "card.variant": "elevated",
    "card.hover": "lift",
    "shadow.header": "0 8px 30px color-mix(in srgb, var(--theme-text) 8%, transparent)",
    "header.variant": "luxury",
    "header.mainHeight": "88px",
    "header.utilityHeight": "34px",
    "header.logoWidth": "318px",
    "header.logoImageWidth": "112px",
    "header.navGap": "38px",
    "header.utilityVisible": true,
    "header.sticky": true,
    "space.grid": "clamp(14px, 2vw, 28px)",
    "space.section": "clamp(48px, 7vw, 96px)",
    "layout.maxWidth": "1440px",
    "motion.fast": "160ms",
    "motion.normal": "260ms",
    "motion.slow": "480ms",
    "space.xs": "4px",
    "space.sm": "8px",
    "space.md": "16px",
    "space.lg": "24px",
    "space.xl": "40px",
  };

  const merged = { ...base, ...parseDesignTokenOverrides(design.designTokensJson) };
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [
      key,
      typeof value === "string" ? sanitizeCssValue(value) : value,
    ]),
  ) as ThemeTokenMap;
}

export function resolveDesignTheme(design: SiteDesign): ResolvedDesignTheme {
  return { version: 1, tokens: resolveDesignTokens(design), components: { ...COMPONENT_REGISTRY } };
}

function declaration(name: string, value: unknown) {
  return `--${name.replaceAll(".", "-")}:${String(value)}`;
}

export function compileDesignCss(design: SiteDesign) {
  const theme = resolveDesignTheme(design);
  const headerPalette = deriveHeaderPalette(design.primaryColor);
  const t = theme.tokens;
  const rootTokens = [
    declaration("brand-primary", t["color.primary"]),
    declaration("brand-secondary", t["color.secondary"]),
    declaration("brand-primary-text", t["color.primaryText"]),
    declaration("header-bg-start", headerPalette.headerStart),
    declaration("header-bg-end", headerPalette.headerEnd),
    declaration("header-utility-bg", headerPalette.utility),
    declaration("header-nav-bg", headerPalette.navigation),
    declaration("header-search-bg", headerPalette.search),
    declaration("header-mobile-bg", headerPalette.mobileDrawer),
    declaration("theme-bg", t["color.light.background"]),
    declaration("theme-surface", t["color.light.surface"]),
    declaration("theme-text", t["color.light.text"]),
    declaration("theme-muted", t["color.light.muted"]),
    declaration("theme-border", t["color.light.border"]),
    declaration("brand-font", t["font.body"]),
    declaration("brand-heading-font", t["font.heading"]),
    declaration("font-size-body", t["typography.body.size"]),
    declaration("font-weight-body", t["typography.body.weight"]),
    declaration("line-height-body", t["typography.body.lineHeight"]),
    declaration("letter-spacing-body", t["typography.body.letterSpacing"]),
    declaration("font-size-h1", t["typography.h1.size"]),
    declaration("font-weight-h1", t["typography.h1.weight"]),
    declaration("line-height-h1", t["typography.h1.lineHeight"]),
    declaration("letter-spacing-h1", t["typography.h1.letterSpacing"]),
    declaration("font-size-h2", t["typography.h2.size"]),
    declaration("font-weight-h2", t["typography.h2.weight"]),
    declaration("line-height-h2", t["typography.h2.lineHeight"]),
    declaration("letter-spacing-h2", t["typography.h2.letterSpacing"]),
    declaration("font-size-h3", t["typography.h3.size"]),
    declaration("font-weight-h3", t["typography.h3.weight"]),
    declaration("line-height-h3", t["typography.h3.lineHeight"]),
    declaration("letter-spacing-h3", t["typography.h3.letterSpacing"]),
    declaration("font-size-small", t["typography.small.size"]),
    declaration("font-weight-small", t["typography.small.weight"]),
    declaration("line-height-small", t["typography.small.lineHeight"]),
    declaration("letter-spacing-small", t["typography.small.letterSpacing"]),
    declaration("type-scale", t["typography.scale.desktop"]),
    declaration("brand-radius", t["radius.base"]),
    declaration("radius-button", t["radius.button"]),
    declaration("radius-input", t["radius.input"]),
    declaration("radius-card", t["radius.card"]),
    declaration("radius-hero", t["radius.hero"]),
    declaration("shadow-button", t["shadow.button"]),
    declaration("button-height", t["button.height"]),
    declaration("button-padding-x", t["button.paddingX"]),
    declaration("button-border-width", t["button.borderWidth"]),
    declaration("button-font-weight", t["button.fontWeight"]),
    declaration("button-text-transform", t["button.textTransform"]),
    declaration("shadow-card", t["shadow.card"]),
    declaration("card-padding", t["card.padding"]),
    declaration("card-border-width", t["card.borderWidth"]),
    declaration("card-image-radius", t["card.imageRadius"]),
    declaration("shadow-header", t["shadow.header"]),
    declaration("header-main-height", t["header.mainHeight"]),
    declaration("header-utility-height", t["header.utilityHeight"]),
    declaration("header-logo-width", t["header.logoWidth"]),
    declaration("header-logo-image-width", t["header.logoImageWidth"]),
    declaration("header-nav-gap", t["header.navGap"]),
    declaration("header-utility-display", Boolean(t["header.utilityVisible"]) ? "block" : "none"),
    declaration("header-position", Boolean(t["header.sticky"]) ? "fixed" : "relative"),
    declaration("space-grid", t["space.grid"]),
    declaration("space-section", t["space.section"]),
    declaration("layout-max-width", t["layout.maxWidth"]),
    declaration("motion-fast", t["motion.fast"]),
    declaration("motion-normal", t["motion.normal"]),
    declaration("motion-slow", t["motion.slow"]),
    declaration("space-xs", t["space.xs"]),
    declaration("space-sm", t["space.sm"]),
    declaration("space-md", t["space.md"]),
    declaration("space-lg", t["space.lg"]),
    declaration("space-xl", t["space.xl"]),
    `--wine-950:color-mix(in srgb,${String(t["color.primary"])} 58%,black 42%)`,
    `--wine-900:color-mix(in srgb,${String(t["color.primary"])} 76%,black 24%)`,
    `--wine-800:${String(t["color.primary"])}`,
    `--wine-700:color-mix(in srgb,${String(t["color.primary"])} 84%,white 16%)`,
    `--gold-500:${String(t["color.secondary"])}`,
    `--cream:${String(t["color.light.background"])}`,
    `--paper:${String(t["color.light.surface"])}`,
    `--ink:${String(t["color.light.text"])}`,
  ].join(";");

  const darkTokens = [
    declaration("theme-bg", t["color.dark.background"]),
    declaration("theme-surface", t["color.dark.surface"]),
    declaration("theme-text", t["color.dark.text"]),
    declaration("theme-muted", t["color.dark.muted"]),
    declaration("theme-border", t["color.dark.border"]),
    `--cream:${String(t["color.dark.background"])}`,
    `--paper:${String(t["color.dark.surface"])}`,
    `--ink:${String(t["color.dark.text"])}`,
  ].join(";");

  const storefrontTypography = `[data-storefront-root]{font-family:var(--brand-font);font-size:var(--font-size-body);font-weight:var(--font-weight-body);line-height:var(--line-height-body);letter-spacing:var(--letter-spacing-body)}[data-storefront-root] h1,[data-storefront-root] h2,[data-storefront-root] h3,[data-storefront-root] h4,[data-storefront-root] h5,[data-storefront-root] h6{font-family:var(--brand-heading-font)}[data-storefront-root] h1{font-size:var(--font-size-h1);font-weight:var(--font-weight-h1);line-height:var(--line-height-h1);letter-spacing:var(--letter-spacing-h1)}[data-storefront-root] h2{font-size:var(--font-size-h2);font-weight:var(--font-weight-h2);line-height:var(--line-height-h2);letter-spacing:var(--letter-spacing-h2)}[data-storefront-root] h3{font-size:var(--font-size-h3);font-weight:var(--font-weight-h3);line-height:var(--line-height-h3);letter-spacing:var(--letter-spacing-h3)}[data-storefront-root] small{font-size:var(--font-size-small);font-weight:var(--font-weight-small);line-height:var(--line-height-small);letter-spacing:var(--letter-spacing-small)}`;
  const tabletTypography = `@media(max-width:1024px){[data-storefront-root]{font-size:${scaledLength(t["typography.body.size"],t["typography.scale.tablet"])}}[data-storefront-root] h1{font-size:${scaledLength(t["typography.h1.size"],t["typography.scale.tablet"])}}[data-storefront-root] h2{font-size:${scaledLength(t["typography.h2.size"],t["typography.scale.tablet"])}}[data-storefront-root] h3{font-size:${scaledLength(t["typography.h3.size"],t["typography.scale.tablet"])}}[data-storefront-root] small{font-size:${scaledLength(t["typography.small.size"],t["typography.scale.tablet"])}}}`;
  const mobileTypography = `@media(max-width:640px){[data-storefront-root]{font-size:${scaledLength(t["typography.body.size"],t["typography.scale.mobile"])};--mobile-horizontal-padding:${String(t["responsive.mobile.horizontalPadding"])};}[data-storefront-root] h1{font-size:${scaledLength(t["typography.h1.size"],t["typography.scale.mobile"])}}[data-storefront-root] h2{font-size:${scaledLength(t["typography.h2.size"],t["typography.scale.mobile"])}}[data-storefront-root] h3{font-size:${scaledLength(t["typography.h3.size"],t["typography.scale.mobile"])}}[data-storefront-root] small{font-size:${scaledLength(t["typography.small.size"],t["typography.scale.mobile"])}}[data-storefront-root] header img{max-width:${String(t["responsive.mobile.logoImageWidth"])}!important}[data-storefront-root] [class*="hero" i]{min-height:${String(t["responsive.mobile.heroMinHeight"])}!important}[data-storefront-root] [class*="heroContent" i],[data-storefront-root] [class*="content" i]{padding-left:var(--mobile-horizontal-padding)!important;padding-right:var(--mobile-horizontal-padding)!important}[data-storefront-root] [class*="productGrid" i],[data-storefront-root] [class*="productsGrid" i]{grid-template-columns:repeat(${Math.max(1,Math.min(2,Number(t["responsive.mobile.productColumns"])||1))},minmax(0,1fr))!important}}`;

  const hoverTransform = String(t["button.hover"]) === "scale" ? "scale(1.035)" : String(t["button.hover"]) === "lift" ? "translateY(-2px)" : "none";
  const storefrontButtons = `[data-storefront-root] button,[data-storefront-root] a[class*="button" i],[data-storefront-root] a[class*="btn" i]{min-height:var(--button-height);padding-left:var(--button-padding-x);padding-right:var(--button-padding-x);border-radius:var(--radius-button);border-width:var(--button-border-width);font-weight:var(--button-font-weight);text-transform:var(--button-text-transform);box-shadow:var(--shadow-button);transition:transform var(--motion-fast),box-shadow var(--motion-fast),background-color var(--motion-fast),color var(--motion-fast),border-color var(--motion-fast)}[data-storefront-root] button:hover,[data-storefront-root] a[class*="button" i]:hover,[data-storefront-root] a[class*="btn" i]:hover{transform:${hoverTransform}}`;
  const cardVariant = String(t["card.variant"]);
  const cardHover = String(t["card.hover"]);
  const cardBackground = cardVariant === "glass" ? "color-mix(in srgb,var(--theme-surface) 78%,transparent)" : "var(--theme-surface)";
  const cardShadow = cardVariant === "flat" || cardVariant === "outline" ? "none" : "var(--shadow-card)";
  const cardBorderColor = cardVariant === "glass" ? "color-mix(in srgb,var(--theme-border) 65%,transparent)" : "var(--theme-border)";
  const cardHoverTransform = cardHover === "scale" ? "scale(1.018)" : cardHover === "lift" ? "translateY(-6px)" : "none";
  const cardHoverBorder = cardHover === "border" ? "var(--brand-secondary)" : cardBorderColor;
  // Target only the actual CSS-module card root class (for example
  // `DbProductCard_card__...`). The old `[class*="card"]` selector also
  // matched every child because the module name itself contains "Card",
  // which added borders/backgrounds around category, title and price text.
  const storefrontCards = `[data-storefront-root] [class*="_card__" i]{border-radius:var(--radius-card);border-style:solid;border-width:var(--card-border-width);border-color:${cardBorderColor};background:${cardBackground};box-shadow:${cardShadow};transition:transform var(--motion-normal),box-shadow var(--motion-normal),border-color var(--motion-normal),background-color var(--motion-normal)}[data-storefront-root] [class*="_card__" i]:hover{transform:${cardHoverTransform};border-color:${cardHoverBorder}}[data-storefront-root] [class*="_card__" i] img{border-radius:var(--card-image-radius)}`;
  // Global brand overrides deliberately target the storefront's existing CSS-module
  // classes. This makes one palette control every page, including legacy sections
  // that previously contained fixed burgundy/gold values.
  const globalBrandOverrides = `
[data-storefront-root] header[class*="header" i]{background:radial-gradient(circle at 22% 0%,color-mix(in srgb,var(--brand-primary) 88%,white 12% / 22%),transparent 33%),linear-gradient(180deg,var(--header-bg-start),var(--header-bg-end))!important}
[data-storefront-root] [class*="utilityBar" i]{background:var(--header-utility-bg)!important}
[data-storefront-root] [class*="mainBar" i]{background:var(--brand-primary)!important}
[data-storefront-root] [class*="desktopNav" i]{background:var(--header-nav-bg)!important}
[data-storefront-root] form[class*="search" i],[data-storefront-root] [class*="mobileSearch" i]{background:var(--header-search-bg)!important}
[data-storefront-root] [class*="mobileDrawer" i]{background:var(--brand-primary)!important;background-color:var(--brand-primary)!important;background-image:none!important;opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;mix-blend-mode:normal!important}
[data-storefront-root] main[class*="main" i]{background:var(--theme-bg)!important;color:var(--theme-text)!important}
[data-storefront-root] section[class*="hero" i]{border-radius:var(--radius-hero)!important}
[data-storefront-root] [class*="heroShade" i]{background:linear-gradient(90deg,color-mix(in srgb,var(--brand-primary) 96%,black 4%) 0%,color-mix(in srgb,var(--brand-primary) 86%,transparent) 42%,color-mix(in srgb,var(--brand-primary) 20%,transparent) 74%),linear-gradient(0deg,color-mix(in srgb,var(--brand-primary) 28%,transparent),transparent)!important}
[data-storefront-root] [class*="heroContent" i]>span,[data-storefront-root] [class*="sliderArrow" i]{color:var(--brand-secondary)!important}
[data-storefront-root] [class*="heroContent" i] a{background:linear-gradient(135deg,color-mix(in srgb,var(--brand-secondary) 78%,white 22%),var(--brand-secondary))!important;color:color-mix(in srgb,var(--brand-primary) 72%,black 28%)!important}
[data-storefront-root] [class*="dots" i] i:first-child{background:var(--brand-secondary)!important}
[data-storefront-root] footer[class*="footer" i],[data-storefront-root] [class*="storeFooter" i]{background:var(--brand-primary)!important;color:var(--brand-primary-text,#fff)!important}
[data-storefront-root] [class*="sectionTitle" i] h2,[data-storefront-root] [class*="categoryCard" i] h3{color:var(--theme-text)!important}
[data-storefront-root] [class*="sectionTitle" i] span{background:linear-gradient(90deg,transparent,var(--brand-secondary))!important}
[data-storefront-root] [class*="sectionTitle" i] span:last-child{background:linear-gradient(90deg,var(--brand-secondary),transparent)!important}
[data-storefront-root] [class*="categoryCard" i] b{border-color:var(--brand-secondary)!important;color:var(--brand-primary)!important}
`;
  return `:root{${rootTokens}}html[data-theme="dark"]{${darkTokens}}body{font-family:var(--brand-font)}h1,h2,h3,h4,h5,h6{font-family:var(--brand-heading-font)}${storefrontTypography}${storefrontButtons}${storefrontCards}${globalBrandOverrides}button,[class*="button" i]{border-radius:var(--radius-button);transition-duration:var(--motion-fast)}input,select,textarea{border-radius:var(--radius-input)}${tabletTypography}${mobileTypography}`;
}
