import { NextResponse } from "next/server";
import { getPermissionKeys, replaceAdminPermissions, requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш право да преглеждаш администраторските права." }, { status: 403 });
  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ error: "Невалиден потребител." }, { status: 400 });
  return NextResponse.json({ permissions: await getPermissionKeys(userId) });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:MANAGE");
  if (!admin) return NextResponse.json({ error: "Нямаш право да задаваш администраторски права." }, { status: 403 });
  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ error: "Невалиден потребител." }, { status: 400 });
  if (userId === admin.id) return NextResponse.json({ error: "Не можеш да променяш собствените си права." }, { status: 400 });
  try {
    const body = await request.json();
    await replaceAdminPermissions(userId, Array.isArray(body.permissions) ? body.permissions : [], admin.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Правата не бяха записани." }, { status: 400 });
  }
}
