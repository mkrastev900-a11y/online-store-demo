import { NextResponse } from "next/server";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { readSocialNetworks, saveSocialNetworks } from "@/lib/social-networks-db";

import { isSameOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  return NextResponse.json({ socialNetworks: await readSocialNetworks() });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямаш право да променяш социалните мрежи." }, { status: 403 });
  try {
    const body = await request.json();
    const socialNetworks = await saveSocialNetworks(body);
    return NextResponse.json({ socialNetworks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Социалните мрежи не бяха запазени." },
      { status: 400 },
    );
  }
}
