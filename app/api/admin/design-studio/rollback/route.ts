import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { rollbackTheme } from "@/lib/design-studio";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за възстановяване." }, { status: 403 });
  const body = await request.json();
  const themeId = Number(body.themeId); const versionId = Number(body.versionId);
  if (!Number.isInteger(themeId) || !Number.isInteger(versionId)) return NextResponse.json({ error: "Невалидна версия." }, { status: 400 });
  try {
    const snapshot = await rollbackTheme(themeId, versionId, admin.id);
    await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_ROLLBACK", entityType: "DesignTheme", entityId: themeId, description: "Предишна версия е приложена като текуща тема без създаване на нова версия." });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Грешка при възстановяване." }, { status: 404 }); }
}
