const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET || "";
const enabled = process.env.DEMO_MODE === "true";
const intervalMs = 5 * 60 * 1000;

if (!enabled) {
  console.log("Demo cleanup scheduler is disabled (DEMO_MODE != true).\n");
  process.exit(0);
}
if (!secret) {
  console.error("Demo cleanup scheduler requires CRON_SECRET.");
  process.exit(1);
}

async function runCleanup() {
  try {
    const response = await fetch(`${baseUrl}/api/internal/demo-cleanup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      console.error(`Demo cleanup HTTP ${response.status}`);
      return;
    }
    const body = await response.json();
    console.log("Demo cleanup completed", body?.summary || body);
  } catch (error) {
    // Next.js may still be starting. The next scheduled run will retry.
    console.error("Demo cleanup scheduler retry later:", error instanceof Error ? error.message : String(error));
  }
}

console.log("Local demo cleanup scheduler active: every 5 minutes; TTL is controlled by DEMO_DATA_TTL_MINUTES.");
setTimeout(runCleanup, 60_000);
setInterval(runCleanup, intervalMs);
