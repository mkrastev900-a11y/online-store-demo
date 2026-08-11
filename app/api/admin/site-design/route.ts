import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_DESIGN, getSiteDesign } from "@/lib/site-design";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

const fields = Object.keys(DEFAULT_SITE_DESIGN).filter((key) => key !== "id");
const booleanFields = new Set([
  "showHero",
  "showBenefits",
  "showCategories",
  "showProducts",
  "seoIndex",
  "seoFollow",
]);

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

function normalizeField(key: string, value: unknown) {
  if (booleanFields.has(key)) return toBoolean(value);
  if (key === "borderRadius") return Math.max(0, Math.min(48, Number(value) || 0));
  if (key === "faviconUrl") return value ? String(value).trim() : null;
  return String(value ?? "").trim();
}

export async function GET() {
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:VIEW", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате достъп." }, { status: 403 });
  return NextResponse.json(await getSiteDesign());
}

export async function PUT(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за редакция." }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = { updatedById: admin.id };

  for (const key of fields) {
    if (key in body) data[key] = normalizeField(key, body[key]);
  }

  const saved = await prisma.siteDesignSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "SITE_DESIGN_UPDATED",
    entityType: "SiteDesignSettings",
    entityId: 1,
    description: "Дизайнът и брандът на магазина са обновени.",
  });

  return NextResponse.json(saved);
}
