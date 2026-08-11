import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("30-minute demo cleanup never touches social-network settings", () => {
  const cleanup = readFileSync("lib/demo-data-cleanup-core.ts", "utf8");
  const social = readFileSync("lib/social-networks-db.ts", "utf8");

  assert.match(social, /prisma\.siteDesignSettings/);
  assert.match(social, /facebookUrl/);
  assert.match(social, /instagramUrl/);
  assert.match(social, /tiktokUrl/);
  assert.match(social, /designTokensJson/);

  assert.doesNotMatch(cleanup, /siteDesignSettings\.(delete|deleteMany|update|updateMany|upsert)/i);
  assert.doesNotMatch(cleanup, /facebookUrl|instagramUrl|tiktokUrl|designTokensJson/);
});
