import { cleanupExpiredDemoData } from "@/lib/demo-data-cleanup";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const GLOBAL_KEY = "__onlineStoreDemoCleanupLastAttemptAt";
const MIN_INTERVAL_MS = 60_000;

type CleanupGlobal = typeof globalThis & { __onlineStoreDemoCleanupLastAttemptAt?: number };

/**
 * Best-effort cleanup for public demo deployments.
 * It keeps the 30-minute TTL useful even on Vercel Hobby, where frequent Cron Jobs
 * are not available. It never blocks the request with an uncaught cleanup error.
 */
export async function maybeCleanupExpiredDemoData() {
  if (!isDemoModeEnabled()) return;

  const holder = globalThis as CleanupGlobal;
  const now = Date.now();
  if (holder[GLOBAL_KEY] && now - holder[GLOBAL_KEY] < MIN_INTERVAL_MS) return;
  holder[GLOBAL_KEY] = now;

  try {
    await cleanupExpiredDemoData();
  } catch (error) {
    console.warn("Best-effort demo cleanup skipped after an error.",
      error instanceof Error ? error.message : "Unknown cleanup error");
  }
}
