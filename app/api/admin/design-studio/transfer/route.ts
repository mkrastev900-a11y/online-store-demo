import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_DESIGN, type SiteDesign } from "@/lib/site-design";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

const PACKAGE_FORMAT = "online-store-design-theme";
const PACKAGE_VERSION = 1;

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "imported-theme";
}

async function uniqueSlug(name: string) {
  const base = slugify(name); let candidate = base; let n = 2;
  while (await prisma.designTheme.findUnique({ where: { slug: candidate }, select: { id: true } })) candidate = `${base}-${n++}`;
  return candidate;
}

function normalizeSnapshot(value: unknown): SiteDesign {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Файлът не съдържа валидна тема.");
  const raw = value as Record<string, unknown>;
  return { ...DEFAULT_SITE_DESIGN, ...raw, id: 1 } as SiteDesign;
}

export async function GET(request: Request) {
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:VIEW", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате достъп." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Невалидна тема." }, { status: 400 });
  const theme = await prisma.designTheme.findUnique({ where: { id }, select: { id: true, name: true, slug: true, description: true, draftSnapshot: true, publishedSnapshot: true, status: true, updatedAt: true } });
  if (!theme) return NextResponse.json({ error: "Темата не е намерена." }, { status: 404 });
  const payload = {
    format: PACKAGE_FORMAT,
    packageVersion: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    generator: "Online Store Web Design Studio",
    theme: {
      name: theme.name,
      description: theme.description,
      sourceSlug: theme.slug,
      sourceStatus: theme.status,
      snapshot: normalizeSnapshot(theme.draftSnapshot ?? theme.publishedSnapshot),
    },
  };
  await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_EXPORTED", entityType: "DesignTheme", entityId: id, description: `Експортирана е тема „${theme.name}“.` });
  const fileName = `${slugify(theme.name)}.store-theme.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за импорт." }, { status: 403 });
  try {
    const body = await request.json();
    if (body?.format !== PACKAGE_FORMAT || Number(body?.packageVersion) !== PACKAGE_VERSION) return NextResponse.json({ error: "Неподдържан или повреден theme файл." }, { status: 400 });
    const source = body?.theme;
    const originalName = String(source?.name ?? "Импортирана тема").trim();
    const requestedName = String(body?.name ?? originalName).trim();
    if (requestedName.length < 2 || requestedName.length > 100) return NextResponse.json({ error: "Името на темата трябва да е между 2 и 100 символа." }, { status: 400 });
    const snapshot = normalizeSnapshot(source?.snapshot);
    const theme = await prisma.designTheme.create({ data: { name: requestedName, slug: await uniqueSlug(requestedName), description: String(source?.description ?? "Импортирана тема").slice(0, 500), status: "DRAFT", isActive: false, draftSnapshot: snapshot, publishedSnapshot: undefined, createdById: admin.id, updatedById: admin.id } });
    await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_IMPORTED", entityType: "DesignTheme", entityId: theme.id, description: `Импортирана е тема „${requestedName}“ като чернова.` });
    return NextResponse.json({ ok: true, theme: { id: theme.id, name: theme.name, slug: theme.slug, description: theme.description, status: theme.status, isActive: theme.isActive, publishedAt: theme.publishedAt, updatedAt: theme.updatedAt }, design: snapshot, versions: [], hasUnpublishedChanges: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Файлът не може да бъде импортиран." }, { status: 400 });
  }
}
