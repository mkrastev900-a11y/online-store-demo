import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_DESIGN, type SiteDesign } from "@/lib/site-design";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "theme";
}
function snapshot(value: unknown): SiteDesign {
  return { ...DEFAULT_SITE_DESIGN, ...((value && typeof value === "object" && !Array.isArray(value)) ? value : {}), id: 1 } as SiteDesign;
}
async function uniqueSlug(name: string, excludeId?: number) {
  const base = slugify(name); let candidate = base; let n = 2;
  while (await prisma.designTheme.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) candidate = `${base}-${n++}`;
  return candidate;
}

export async function GET(request: Request) {
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:VIEW", "WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате достъп." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Невалидна тема." }, { status: 400 });
  const theme = await prisma.designTheme.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, label: true, createdAt: true } } } });
  if (!theme) return NextResponse.json({ error: "Темата не е намерена." }, { status: 404 });
  return NextResponse.json({ theme: { id: theme.id, name: theme.name, slug: theme.slug, description: theme.description, status: theme.status, isActive: theme.isActive, publishedAt: theme.publishedAt, updatedAt: theme.updatedAt }, design: snapshot(theme.draftSnapshot), versions: theme.versions, hasUnpublishedChanges: JSON.stringify(theme.draftSnapshot) !== JSON.stringify(theme.publishedSnapshot) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за създаване." }, { status: 403 });
  const body = await request.json(); const name = String(body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Въведи име на темата." }, { status: 400 });
  const sourceId = Number(body.sourceThemeId); let base: SiteDesign = snapshot(DEFAULT_SITE_DESIGN);
  if (Number.isInteger(sourceId) && sourceId > 0) { const source = await prisma.designTheme.findUnique({ where: { id: sourceId }, select: { draftSnapshot: true } }); if (source) base = snapshot(source.draftSnapshot); }
  const theme = await prisma.designTheme.create({ data: { name, slug: await uniqueSlug(name), description: String(body.description ?? "").trim(), status: "DRAFT", isActive: false, draftSnapshot: base, createdById: admin.id, updatedById: admin.id } });
  await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_CREATED", entityType: "DesignTheme", entityId: theme.id, description: `Създадена е тема „${name}“.` });
  return NextResponse.json({ theme, design: base, versions: [], hasUnpublishedChanges: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за редакция." }, { status: 403 });
  const body = await request.json(); const id = Number(body.id); const name = String(body.name ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || name.length < 2) return NextResponse.json({ error: "Невалидни данни." }, { status: 400 });
  const theme = await prisma.designTheme.update({ where: { id }, data: { name, slug: await uniqueSlug(name, id), description: String(body.description ?? "").trim(), updatedById: admin.id } });
  await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_RENAMED", entityType: "DesignTheme", entityId: id, description: `Темата е преименувана на „${name}“.` });
  return NextResponse.json({ theme });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за изтриване." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const theme = await prisma.designTheme.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
  if (!theme) return NextResponse.json({ error: "Темата не е намерена." }, { status: 404 });
  if (theme.isActive) return NextResponse.json({ error: "Активната тема не може да бъде изтрита." }, { status: 409 });
  if (await prisma.designTheme.count() <= 1) return NextResponse.json({ error: "Последната тема не може да бъде изтрита." }, { status: 409 });
  await prisma.designTheme.delete({ where: { id } });
  await writeAuditLog({ actorId: admin.id, action: "DESIGN_THEME_DELETED", entityType: "DesignTheme", entityId: id, description: `Изтрита е тема „${theme.name}“.` });
  return NextResponse.json({ ok: true });
}
