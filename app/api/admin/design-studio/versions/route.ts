import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { deleteThemeVersion, getThemeVersionsState } from "@/lib/design-studio";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET(request: Request) {
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:VIEW", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате достъп." }, { status: 403 });
  const themeId = Number(new URL(request.url).searchParams.get("themeId"));
  if (!Number.isInteger(themeId) || themeId < 1) return NextResponse.json({ error: "Невалидна тема." }, { status: 400 });
  return NextResponse.json(await getThemeVersionsState(themeId));
}


export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за изтриване на версии." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const themeId = Number(body.themeId);
  const versionId = Number(body.versionId);
  if (!Number.isInteger(themeId) || themeId < 1 || !Number.isInteger(versionId) || versionId < 1) {
    return NextResponse.json({ error: "Невалидна версия." }, { status: 400 });
  }
  try {
    await deleteThemeVersion(themeId, versionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Грешка при изтриване на версията." }, { status: 404 });
  }
}
