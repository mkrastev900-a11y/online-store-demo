import { NextResponse } from "next/server";
import { readMarketingIntegrations, saveMarketingIntegrations } from "@/lib/marketing-integrations";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  return NextResponse.json({ integrations: await readMarketingIntegrations() });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямаш право да променяш маркетинг интеграциите." }, { status: 403 });

  try {
    const body = await request.json();
    return NextResponse.json({ integrations: await saveMarketingIntegrations(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Интеграциите не бяха запазени." }, { status: 400 });
  }
}
