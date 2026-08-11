import { NextResponse } from "next/server";
import { getPublicMarketingIntegrations } from "@/lib/marketing-integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ integrations: await getPublicMarketingIntegrations() });
}
