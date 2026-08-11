import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Visual Editor and theme writes cannot erase social-network settings", () => {
  const route = readFileSync("app/api/admin/site-design/route.ts", "utf8");
  const studio = readFileSync("lib/design-studio.ts", "utf8");
  const design = readFileSync("lib/site-design.ts", "utf8");

  assert.match(route, /facebookUrl.*instagramUrl.*tiktokUrl/);
  assert.match(route, /preservePersistentSocialTokens/);
  assert.match(studio, /current\.facebookUrl/);
  assert.match(studio, /current\.instagramUrl/);
  assert.match(studio, /current\.tiktokUrl/);
  assert.match(studio, /preservePersistentSocialTokens/);
  assert.match(design, /social\.facebook\.enabled/);
  assert.match(design, /social\.instagram\.enabled/);
  assert.match(design, /social\.tiktok\.enabled/);
});
