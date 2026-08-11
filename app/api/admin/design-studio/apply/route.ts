import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { applyThemeWithoutVersion, getThemeVersionsState } from "@/lib/design-studio";
import { DEFAULT_SITE_DESIGN } from "@/lib/site-design";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за прилагане на тема." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const themeId = Number(body.themeId);
  if (!Number.isInteger(themeId) || themeId < 1) return NextResponse.json({ error: "Невалидна тема." }, { status: 400 });
  const snapshot = { ...DEFAULT_SITE_DESIGN, ...(body.snapshot ?? {}), id: 1 };
  try {
    const result = await applyThemeWithoutVersion(themeId, snapshot, admin.id);
    const versionState = await getThemeVersionsState(themeId);
    await writeAuditLog({
      actorId: admin.id,
      action: "DESIGN_THEME_APPLIED_WITHOUT_VERSION",
      entityType: "DesignTheme",
      entityId: themeId,
      description: "Темата е приложена за тест без създаване на нова версия.",
    });
    return NextResponse.json({ ok: true, snapshot: result.snapshot, activeVersionId: versionState.activeVersionId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Грешка при прилагане на темата." }, { status: 500 });
  }
}
