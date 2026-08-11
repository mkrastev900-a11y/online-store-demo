import os from "node:os";
import packageJson from "@/package.json";
import { prisma } from "@/lib/prisma";
import { getCloudinary } from "@/lib/cloudinary";

export type HealthStatus = "healthy" | "warning" | "error";

export type HealthCheck = {
  id: string;
  name: string;
  category: "database" | "service" | "security" | "runtime";
  status: HealthStatus;
  summary: string;
  detail: string;
  latencyMs?: number;
};

export type SystemHealthSnapshot = {
  checkedAt: string;
  overall: HealthStatus;
  score: number;
  checks: HealthCheck[];
  runtime: {
    appVersion: string;
    nodeVersion: string;
    nextVersion: string;
    prismaVersion: string;
    environment: string;
    uptimeSeconds: number;
    processMemoryMb: number;
    systemMemoryUsedPercent: number;
    cpuLoadPercent: number;
    cpuCount: number;
    deployment: string;
  };
};

const timeoutSignal = (milliseconds: number) => AbortSignal.timeout(milliseconds);

function statusFromPercent(percent: number, warningAt: number, errorAt: number): HealthStatus {
  if (percent >= errorAt) return "error";
  if (percent >= warningAt) return "warning";
  return "healthy";
}

async function checkDatabase(): Promise<HealthCheck> {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      id: "database",
      name: process.env.DATABASE_URL?.startsWith("postgres") ? "Neon PostgreSQL" : "Local SQLite",
      category: "database",
      status: latencyMs > 1200 ? "warning" : "healthy",
      summary: latencyMs > 1200 ? "Свързана, но бавна" : "Свързана",
      detail: `Заявката към базата отговори за ${latencyMs} ms.`,
      latencyMs,
    };
  } catch (error) {
    return {
      id: "database",
      name: process.env.DATABASE_URL?.startsWith("postgres") ? "Neon PostgreSQL" : "Local SQLite",
      category: "database",
      status: "error",
      summary: "Няма връзка",
      detail: error instanceof Error ? error.message : "Неуспешна проверка на базата данни.",
    };
  }
}

async function checkCloudinary(): Promise<HealthCheck> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { id: "cloudinary", name: "Cloudinary", category: "service", status: "warning", summary: "Непълна конфигурация", detail: "Липсва CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY или CLOUDINARY_API_SECRET." };
  }

  const startedAt = performance.now();
  try {
    // Use the same official Cloudinary SDK configuration as the actual upload/delete routes.
    // This avoids a health-check-only authentication path that can disagree with runtime behavior.
    const ping = getCloudinary().api.ping();
    await Promise.race([
      ping,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Cloudinary timeout")), 4500)),
    ]);
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      id: "cloudinary",
      name: "Cloudinary",
      category: "service",
      status: "healthy",
      summary: "API работи",
      detail: `Cloudinary SDK потвърди връзката за ${latencyMs} ms.`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : "Cloudinary authentication failed";
    const status = typeof error === "object" && error && "http_code" in error ? Number((error as { http_code?: unknown }).http_code) : undefined;
    return {
      id: "cloudinary",
      name: "Cloudinary",
      category: "service",
      status: status && status >= 500 ? "error" : "warning",
      summary: status ? `API отговор ${status}` : "API проверката не успя",
      detail: message.slice(0, 220),
      latencyMs,
    };
  }
}

async function checkResend(): Promise<HealthCheck> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { id: "resend", name: "Resend", category: "service", status: "warning", summary: "Липсва API ключ", detail: "Добави RESEND_API_KEY, за да работят транзакционните имейли." };
  }

  const startedAt = performance.now();
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: timeoutSignal(4500),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    return response.ok
      ? { id: "resend", name: "Resend", category: "service", status: "healthy", summary: "API работи", detail: `Успешна проверка за ${latencyMs} ms.`, latencyMs }
      : { id: "resend", name: "Resend", category: "service", status: response.status === 401 || response.status === 403 ? "error" : "warning", summary: `API отговор ${response.status}`, detail: "Провери API ключа и правата му.", latencyMs };
  } catch {
    return { id: "resend", name: "Resend", category: "service", status: "warning", summary: "Няма потвърден отговор", detail: "API ключът е наличен, но live проверката не завърши навреме." };
  }
}

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const [database, cloudinary, resend] = await Promise.all([
    checkDatabase(),
    checkCloudinary(),
    checkResend(),
  ]);

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsedPercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);
  const cpuCount = Math.max(os.cpus().length, 1);
  const cpuLoadPercent = Math.min(100, Math.round((os.loadavg()[0] / cpuCount) * 100));
  const processMemoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const sessionConfigured = Boolean(process.env.SESSION_SECRET || process.env.AUTH_SECRET);
  const deploymentConfigured = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

  const checks: HealthCheck[] = [
    database,
    cloudinary,
    resend,
    {
      id: "session-secret",
      name: "Защита на сесиите",
      category: "security",
      status: sessionConfigured ? "healthy" : "error",
      summary: sessionConfigured ? "Конфигурирана" : "Липсва секрет",
      detail: sessionConfigured ? "SESSION_SECRET или AUTH_SECRET е наличен." : "Добави силен SESSION_SECRET или AUTH_SECRET.",
    },
    {
      id: "memory",
      name: "Системна памет",
      category: "runtime",
      status: statusFromPercent(memoryUsedPercent, 75, 90),
      summary: `${memoryUsedPercent}% използвана`,
      detail: `Процесът използва приблизително ${processMemoryMb} MB RAM.`,
    },
    {
      id: "cpu",
      name: "CPU натоварване",
      category: "runtime",
      status: statusFromPercent(cpuLoadPercent, 70, 90),
      summary: `${cpuLoadPercent}% моментно натоварване`,
      detail: `${cpuCount} логически процесора. Стойността е изчислена от 1-минутния load average.`,
    },
    {
      id: "deployment",
      name: "Vercel среда",
      category: "service",
      status: deploymentConfigured || process.env.NODE_ENV === "development" ? "healthy" : "warning",
      summary: deploymentConfigured ? "Разпозната" : process.env.NODE_ENV === "development" ? "Локална разработка" : "Не е разпозната",
      detail: deploymentConfigured ? `Deployment: ${process.env.VERCEL_ENV || "Vercel"}.` : "При локална разработка Vercel променливите не са налични.",
    },
  ];

  const weights: Record<HealthStatus, number> = { healthy: 100, warning: 55, error: 0 };
  const score = Math.round(checks.reduce((sum, check) => sum + weights[check.status], 0) / checks.length);
  const overall: HealthStatus = checks.some((check) => check.status === "error") ? "error" : checks.some((check) => check.status === "warning") ? "warning" : "healthy";

  return {
    checkedAt: new Date().toISOString(),
    overall,
    score,
    checks,
    runtime: {
      appVersion: packageJson.version,
      nodeVersion: process.version,
      nextVersion: packageJson.dependencies?.next || "неизвестна",
      prismaVersion: packageJson.dependencies?.["@prisma/client"] || "неизвестна",
      environment: process.env.NODE_ENV || "unknown",
      uptimeSeconds: Math.round(process.uptime()),
      processMemoryMb,
      systemMemoryUsedPercent: memoryUsedPercent,
      cpuLoadPercent,
      cpuCount,
      deployment: process.env.VERCEL_ENV || (process.env.NODE_ENV === "development" ? "local" : "custom"),
    },
  };
}
