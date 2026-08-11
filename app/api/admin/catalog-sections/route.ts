/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { NextResponse } from "next/server";
import { createAdminCatalogSection, listAdminCatalogSections, slugify } from "@/lib/admin-catalog-structure";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET() {
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:VIEW", "PRODUCTS:VIEW"]);
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  return NextResponse.json({ sections: await listAdminCatalogSections() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT", "PRODUCTS:CREATE"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const slug = slugify(String(body.slug ?? name));
  if (name.length < 2) return NextResponse.json({ error: "Въведи име на секцията." }, { status: 400 });
  try {
    const section = await createAdminCatalogSection({
      name,
      slug,
      eyebrow: String(body.eyebrow ?? "").trim() || name.toUpperCase(),
      description: String(body.description ?? "").trim(),
      baseAudience: "WOMEN" as any,
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || 100,
    });
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Секцията не беше създадена." }, { status: 400 });
  }
}
