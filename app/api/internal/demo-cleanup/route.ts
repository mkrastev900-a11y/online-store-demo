import { NextResponse } from "next/server";

import { hasValidCronSecret } from "@/lib/cron-auth";
import { cleanupExpiredDemoData } from "@/lib/demo-data-cleanup";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo cleanup is disabled." }, { status: 403 });
  }
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await cleanupExpiredDemoData();
    console.info("Demo cleanup completed", {
      ordersDeleted: summary.ordersDeleted,
      ticketsDeleted: summary.ticketsDeleted,
      usersDeleted: summary.usersDeleted,
    });
    return NextResponse.json({ ok: true, summary }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("Demo cleanup failed.");
    return NextResponse.json({ error: "Demo cleanup failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
