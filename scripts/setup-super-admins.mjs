import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

for (const filename of [".env", ".env.local"]) {
  const fullPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) continue;
  for (const rawLine of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const prisma = new PrismaClient();
const emails = String(process.env.BOOTSTRAP_SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!emails.length) {
  console.error("Задай BOOTSTRAP_SUPER_ADMIN_EMAILS с изрично одобрените регистрирани акаунти.");
  process.exit(1);
}

if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
  console.error("BOOTSTRAP_SUPER_ADMIN_EMAILS съдържа невалиден имейл.");
  process.exit(1);
}

for (const email of emails) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true, googleId: true },
  });
  if (!user) {
    console.error(`${email} не е регистриран. Не е извършена промяна.`);
    process.exitCode = 1;
    continue;
  }
  if (!user.emailVerifiedAt && !user.googleId && process.env.BOOTSTRAP_ALLOW_UNVERIFIED !== "true") {
    console.error(`${email} не е потвърден. Потвърди акаунта или за еднократно аварийно действие задай BOOTSTRAP_ALLOW_UNVERIFIED=true.`);
    process.exitCode = 1;
    continue;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN", isActive: true } }),
    prisma.auditLog.create({ data: { actorId: null, action: "SUPER_ADMIN_BOOTSTRAPPED", entityType: "User", entityId: String(user.id), description: `Регистрираният акаунт ${user.email} е зададен като главен администратор чрез операторския bootstrap скрипт.` } }),
  ]);
  console.log(`${email} е зададен като SUPER_ADMIN.`);
}

await prisma.$disconnect();
