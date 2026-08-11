import { NextResponse } from "next/server";
import { deleteAdminCatalogSection, updateAdminCatalogSection, slugify } from "@/lib/admin-catalog-structure";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT", "PRODUCTS:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  try {
    const section = await updateAdminCatalogSection(Number(id), {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.slug !== undefined ? { slug: slugify(String(body.slug)) } : {}),
      ...(body.eyebrow !== undefined ? { eyebrow: String(body.eyebrow).trim() } : {}),
      ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 100 } : {}),
    });
    return NextResponse.json({ section });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Секцията не беше обновена." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT", "PRODUCTS:DELETE"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const { id } = await context.params;
  try {
    return NextResponse.json(await deleteAdminCatalogSection(Number(id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Секцията не беше изтрита." }, { status: 400 });
  }
}
