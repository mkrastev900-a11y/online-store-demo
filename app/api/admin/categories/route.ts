import { NextResponse } from "next/server";
import { createAdminCategory, listAdminCategoriesWithSections, slugify } from "@/lib/admin-catalog-structure";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET() {
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:VIEW", "WEB_DESIGN:VIEW"]);
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  return NextResponse.json({ categories: await listAdminCategoriesWithSections() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:CREATE", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Въведи име на категорията." }, { status: 400 });
  try {
    const category = await createAdminCategory({ name, slug: slugify(String(body.slug ?? name)), sectionId: Number(body.sectionId) > 0 ? Number(body.sectionId) : null });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Категорията не беше създадена." }, { status: 400 });
  }
}
