import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public SEO endpoints exist and exclude private application areas", () => {
  const robots = readFileSync("app/robots.ts", "utf8");
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  assert.match(robots, /\/admin\//);
  assert.match(robots, /\/checkout/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /prisma\.product\.findMany/);
  assert.match(sitemap, /isActive: true/);
});

test("product pages expose product-specific metadata", () => {
  const page = readFileSync("app/products/[slug]/page.tsx", "utf8");
  assert.match(page, /generateMetadata/);
  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /openGraph/);
});

test("image optimizer prefers modern formats", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /image\/avif/);
  assert.match(config, /image\/webp/);
});
