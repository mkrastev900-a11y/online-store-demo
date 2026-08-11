import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/db",
};

const result = spawnSync(process.execPath, [prismaCli, "validate"], {
  env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
