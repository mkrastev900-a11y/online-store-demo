import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");

await access(migrationsDir);

const entries = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (entries.length === 0) {
  throw new Error("No active Prisma migrations were found.");
}

const duplicateTimestamps = entries
  .map((entry) => entry.slice(0, 14))
  .filter((timestamp, index, all) => all.indexOf(timestamp) !== index);
if (duplicateTimestamps.length > 0) {
  throw new Error(`Duplicate migration timestamps: ${[...new Set(duplicateTimestamps)].join(", ")}`);
}

const expected = [
  "20260804020000_add_page_content",
  "20260804080000_size_guides",
  "20260804081500_product_custom_size_guide",
  "20260804084500_size_guide_diagram_points",
  "20260804093000_optional_size_guide_diagram",
  "20260805060000_catalog_sections",
  "20260806013000_password_reset_tokens",
];

const missing = expected.filter((entry) => !entries.includes(entry));
if (missing.length > 0) {
  throw new Error(`Missing required migrations: ${missing.join(", ")}`);
}

for (const entry of entries) {
  const sqlPath = path.join(migrationsDir, entry, "migration.sql");
  let sql;
  try {
    sql = await readFile(sqlPath, "utf8");
  } catch {
    throw new Error(`Migration ${entry} is missing migration.sql.`);
  }
  if (!sql.trim()) {
    throw new Error(`Migration ${entry} contains an empty migration.sql.`);
  }
}

const requiredSql = new Map([
  ["20260804020000_add_page_content", ['"pageContentJson"']],
  ["20260804080000_size_guides", ['CREATE TABLE "SizeGuide"', 'CREATE TABLE "SizeGuideMeasurement"', '"sizeGuideId"']],
  ["20260804081500_product_custom_size_guide", ['"customSizeGuide"', '"hasCustomSizing"']],
  ["20260804084500_size_guide_diagram_points", ['"startX"', '"startY"', '"endX"', '"endY"']],
  ["20260804093000_optional_size_guide_diagram", ['"showDiagram"']],
  ["20260805060000_catalog_sections", ['CREATE TABLE IF NOT EXISTS "CatalogSection"', '"sectionId"']],
  ["20260806013000_password_reset_tokens", ['CREATE TABLE IF NOT EXISTS "PasswordResetToken"', '"tokenHash"', '"expiresAt"']],
]);

for (const [entry, fragments] of requiredSql) {
  const sql = await readFile(path.join(migrationsDir, entry, "migration.sql"), "utf8");
  for (const fragment of fragments) {
    if (!sql.includes(fragment)) {
      throw new Error(`${entry} is missing required SQL fragment: ${fragment}`);
    }
  }
}

const supportExtension = "20260806133000_support_ticket_center_v2";
const supportCreation = "20260806140000_support_tickets";
if (entries.includes(supportExtension) && entries.includes(supportCreation) && entries.indexOf(supportExtension) < entries.indexOf(supportCreation)) {
  console.warn("Migration history warning: support_ticket_center_v2 is ordered before support_tickets. Existing production databases with both migrations applied are unaffected, but a brand-new database should be created from a reviewed baseline instead of replaying this historical chain blindly.");
}

console.log(`Migration layout check passed (${entries.length} migrations).`);
