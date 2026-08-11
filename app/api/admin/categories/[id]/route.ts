import { NextResponse } from "next/server";
import { deleteAdminCategory, updateAdminCategory, slugify } from "@/lib/admin-catalog-structure";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:EDIT", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  try {
    const category = await updateAdminCategory(Number(id), {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.slug !== undefined ? { slug: slugify(String(body.slug)) } : {}),
      ...(body.sectionId !== undefined ? { sectionId: Number(body.sectionId) > 0 ? Number(body.sectionId) : null } : {}),
    });
    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Категорията не беше обновена." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:DELETE", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  const { id } = await context.params;
  try {
    await deleteAdminCategory(Number(id));
    return NextResponse.json({ success: true, deletedId: Number(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Категорията не беше изтрита." }, { status: 400 });
  }
}
