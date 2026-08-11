import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { CURRENT_TERMS_VERSION } from "../lib/terms-version.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

export function readTestAdminConfig(env = process.env) {
  if (env.CREATE_TEST_ADMIN !== "true") return { enabled: false };

  const username = String(env.TEST_ADMIN_USERNAME || "").trim();
  const password = String(env.TEST_ADMIN_PASSWORD || "");
  const email = String(env.TEST_ADMIN_EMAIL || "").trim().toLowerCase();
  const displayName = String(env.TEST_ADMIN_DISPLAY_NAME || "Админ").trim() || "Админ";

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("TEST_ADMIN_USERNAME must contain 3-64 letters, numbers, dots, underscores or hyphens.");
  }
  if (password.length < 3) {
    throw new Error("TEST_ADMIN_PASSWORD must contain at least 3 characters.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("TEST_ADMIN_EMAIL must be a valid email address.");
  }

  return { enabled: true, displayName, email, password, username };
}

export async function ensureTestAdmin(prisma, options = {}) {
  const config = readTestAdminConfig(options.env || process.env);
  if (!config.enabled) return { enabled: false, created: false, user: null };

  const now = options.now || new Date();
  const existing = await prisma.user.findUnique({ where: { email: config.email } });
  const passwordMatches = existing
    ? await bcrypt.compare(config.password, existing.passwordHash)
    : false;
  const passwordHash = passwordMatches
    ? existing.passwordHash
    : await bcrypt.hash(config.password, 12);

  const user = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      authProvider: "credentials",
      emailVerifiedAt: existing?.emailVerifiedAt || now,
      isActive: true,
      name: config.displayName,
      passwordHash,
      role: "SUPER_ADMIN",
      termsAcceptanceRequired: false,
      termsAcceptedAt: existing?.termsAcceptedAt || now,
      termsVersion: CURRENT_TERMS_VERSION,
    },
    create: {
      authProvider: "credentials",
      cart: { create: {} },
      email: config.email,
      emailVerifiedAt: now,
      isActive: true,
      name: config.displayName,
      passwordHash,
      role: "SUPER_ADMIN",
      termsAcceptanceRequired: false,
      termsAcceptedAt: now,
      termsVersion: CURRENT_TERMS_VERSION,
    },
  });

  await prisma.cart.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  options.logger?.info?.(existing ? "Demo administrator verified." : "Demo administrator created.");
  return { enabled: true, created: !existing, user };
}

async function main() {
  const localDemo = process.argv.includes("--local-demo");
  const effectiveEnv = localDemo
    ? {
        ...process.env,
        CREATE_TEST_ADMIN: process.env.CREATE_TEST_ADMIN ?? "true",
        TEST_ADMIN_USERNAME: process.env.TEST_ADMIN_USERNAME ?? "admin",
        TEST_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD ?? "admin",
        TEST_ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL ?? "admin@example.local",
        TEST_ADMIN_DISPLAY_NAME: process.env.TEST_ADMIN_DISPLAY_NAME ?? "Админ",
      }
    : process.env;

  const config = readTestAdminConfig(effectiveEnv);
  if (!config.enabled) {
    console.log("Demo administrator bootstrap is disabled.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await ensureTestAdmin(prisma, { env: effectiveEnv, logger: console });
    console.log(`Demo administrator is ready with role ${result.user.role}.`);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Demo administrator bootstrap failed.");
    process.exitCode = 1;
  });
}
