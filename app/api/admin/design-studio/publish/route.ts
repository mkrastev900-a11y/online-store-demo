import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { publishTheme } from "@/lib/design-studio";
import { DEFAULT_SITE_DESIGN } from "@/lib/site-design";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за публикуване." }, { status: 403 });
  const body = await request.json();
  const themeId = Number(body.themeId);
  if (!Number.isInteger(themeId) || themeId < 1) return NextResponse.json({ error: "Невалидна тема." }, { status: 400 });
  const snapshot = { ...DEFAULT_SITE_DESIGN, ...(body.snapshot ?? {}), id: 1 };
  const label = String(body.label ?? "").trim();
  if (label.length < 2 || label.length > 120) return NextResponse.json({ error: "Въведи име на версията (2–120 символа)." }, { status: 400 });
  const result = await publishTheme(themeId, snapshot, admin.id, label);
  await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_PUBLISHED", entityType: "DesignTheme", entityId: themeId, description: `Темата е публикувана като версия ${result.version}: „${label}“.` });
  return NextResponse.json({ ok: true, version: result.version, snapshot });
}
