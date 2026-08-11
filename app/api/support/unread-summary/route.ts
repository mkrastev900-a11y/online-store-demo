import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { EMPTY_SUPPORT_UNREAD_SUMMARY } from "@/lib/support-unread";
import { getCustomerSupportUnreadSummary } from "@/lib/support-unread.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(EMPTY_SUPPORT_UNREAD_SUMMARY, {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const summary = await getCustomerSupportUnreadSummary(session.userId);
    return NextResponse.json(summary, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[support/unread-summary]", error);
    return NextResponse.json(EMPTY_SUPPORT_UNREAD_SUMMARY, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}
