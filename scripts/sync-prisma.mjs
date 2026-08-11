import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function runPrisma(args) {
  const prismaCli = resolve("node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Изчистване на стария Next.js cache...");
rmSync(resolve(".next"), { recursive: true, force: true });

console.log("Генериране на Prisma Client от текущата schema.prisma...");
runPrisma(["generate"]);

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("Този скрипт е само за локална разработка. За production използвай npm run db:deploy.");
}

console.log("Локално dev синхронизиране на базата с текущата Prisma схема...");
runPrisma(["db", "push"]);

console.log("Готово. Стартирай приложението отново с: npm run dev");
