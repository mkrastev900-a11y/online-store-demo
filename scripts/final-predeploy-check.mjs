import { existsSync, readFileSync } from "node:fs";

const errors = [];
const warnings = [];
const requiredFiles = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "next.config.ts",
  "proxy.ts",
  "app/robots.ts",
  "app/sitemap.ts",
  "docs/DEPLOYMENT.md",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) errors.push(`Липсва release файл: ${file}`);
}

try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  if (pkg.version !== lock.version || pkg.version !== lock.packages?.[""]?.version) {
    errors.push("package.json и package-lock.json не са на една версия.");
  }
  if (!pkg.scripts?.["production:check"]) errors.push("Липсва production:check.");
  if (!pkg.scripts?.["db:deploy"]) errors.push("Липсва db:deploy.");
  if (!pkg.scripts?.qa) errors.push("Липсва qa gate.");
} catch {
  errors.push("package metadata не може да бъде прочетен.");
}

if (existsSync("vercel.json")) {
  try {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const cron of vercel.crons || []) {
      const routePath = `app${cron.path}/route.ts`;
      if (!existsSync(routePath)) errors.push(`Vercel cron сочи към липсващ route: ${cron.path}`);
    }
  } catch {
    errors.push("vercel.json не е валиден JSON.");
  }
}

console.log("ONLINE STORE — FINAL PREDEPLOY STATIC GATE");
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log("Static release structure: OK");
