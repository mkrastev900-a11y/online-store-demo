import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Липсва DIRECT_URL или DATABASE_URL.");

const financeName = "20260718090000_finance_center_v2";
const cmsName = "20260725161000_qa24_16_1_cms_content_models";
const financeFile = path.join(root, "prisma", "migrations", financeName, "migration.sql");
const cmsFile = path.join(root, "prisma", "migrations", cmsName, "migration.sql");
const [financeSql, cmsSql] = await Promise.all([fs.readFile(financeFile, "utf8"), fs.readFile(cmsFile, "utf8")]);
const checksum = (sql) => crypto.createHash("sha256").update(sql).digest("hex");

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(cmsSql);

  const upsertMigration = async (name, hash) => {
    const existing = await client.query(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 ORDER BY started_at DESC LIMIT 1`,
      [name],
    );
    if (existing.rowCount) {
      await client.query(
        `UPDATE "_prisma_migrations"
         SET checksum = $2, finished_at = NOW(), rolled_back_at = NULL,
             logs = NULL, applied_steps_count = 1
         WHERE id = $1`,
        [existing.rows[0].id, hash],
      );
    } else {
      await client.query(
        `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
        [crypto.randomUUID(), hash, name],
      );
    }
  };

  await upsertMigration(financeName, checksum(financeSql));
  await upsertMigration(cmsName, checksum(cmsSql));
  await client.query("COMMIT");
  console.log("CMS таблиците и Prisma migration history са поправени успешно.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
