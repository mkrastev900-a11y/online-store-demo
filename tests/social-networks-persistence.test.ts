import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("social network persistence is database-only", () => {
  const source = readFileSync(join(root, "lib/social-networks-db.ts"), "utf8");
  assert.match(source, /prisma\.siteDesignSettings/);
  assert.doesNotMatch(source, /node:fs|from ["']fs["']|writeFile|writeFileSync|social-networks\.json/);
  assert.equal(existsSync(join(root, "lib/social-networks.ts")), false);
  assert.equal(existsSync(join(root, "data/social-networks.json")), false);
});

test("all active routes import the database-only social network module", () => {
  const files = [
    "app/api/social-networks/route.ts",
    "app/api/admin/social-networks/route.ts",
    "app/admin/social-networks/page.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /@\/lib\/social-networks-db/);
    assert.doesNotMatch(source, /@\/lib\/social-networks["']/);
  }
});
