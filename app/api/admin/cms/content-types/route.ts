import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { ensureCmsSchema } from "@/lib/cms-schema";

import { isSameOriginRequest } from "@/lib/request-security";

const FIELD_TYPES = new Set(["TEXT", "RICH_TEXT", "NUMBER", "PRICE", "BOOLEAN", "DATE", "IMAGE", "GALLERY", "VIDEO", "RELATION", "SELECT", "MULTI_SELECT", "JSON", "FILE"]);

function normalizeSlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeKey(value: unknown) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
function parseFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item, position) => {
    const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const name = String(raw.name ?? "").trim();
    const key = normalizeKey(raw.key || name);
    const type = String(raw.type ?? "TEXT").toUpperCase();
    if (!name || !key || !FIELD_TYPES.has(type)) throw new Error("Невалидно CMS поле.");
    return {
      name, key, type,
      description: String(raw.description ?? "").trim(),
      isRequired: Boolean(raw.isRequired), isUnique: Boolean(raw.isUnique), isMultiple: Boolean(raw.isMultiple),
      position, settings: (raw.settings && typeof raw.settings === "object" ? raw.settings : {}) as Prisma.InputJsonValue,
    };
  });
}

export async function GET() {
  try {
    const admin = await requireAnyAdminPermissionApi(["CMS:VIEW"]);
    if (!admin) return NextResponse.json({ error: "Нямате право за преглед на CMS." }, { status: 403 });
    await ensureCmsSchema();
    const contentTypes = await prisma.cmsContentType.findMany({
      orderBy: { updatedAt: "desc" },
      include: { fields: { orderBy: { position: "asc" } }, _count: { select: { entries: true } } },
    });
    return NextResponse.json({ contentTypes });
  } catch (error) {
    console.error("CMS content types GET failed", error);
    return NextResponse.json(
      { error: "CMS моделите не могат да бъдат заредени. Проверете връзката към базата данни и опитайте отново." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["CMS:CREATE"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за създаване на CMS модели." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const singularName = String(body.singularName ?? name).trim();
    const slug = normalizeSlug(body.slug || name);
    const fields = parseFields(body.fields);
    if (name.length < 2 || singularName.length < 2 || slug.length < 2) return NextResponse.json({ error: "Попълнете валидни имена и slug." }, { status: 400 });
    if (!fields.length) return NextResponse.json({ error: "Добавете поне едно поле." }, { status: 400 });
    const contentType = await prisma.cmsContentType.create({
      data: {
        name, singularName, slug, description: String(body.description ?? "").trim(), icon: String(body.icon ?? "▦").slice(0, 8),
        createdById: admin.id, updatedById: admin.id, fields: { create: fields },
      },
      include: { fields: { orderBy: { position: "asc" } }, _count: { select: { entries: true } } },
    });
    await writeAuditLog({ actorId: admin.id, action: "CMS_CONTENT_TYPE_CREATED", entityType: "CmsContentType", entityId: contentType.id, description: `Създаден е CMS модел „${name}“.` });
    return NextResponse.json({ contentType }, { status: 201 });
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Slug или ключ на поле вече се използва." : error instanceof Error ? error.message : "CMS моделът не беше създаден.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["CMS:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за редакция на CMS модели." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Невалиден CMS модел." }, { status: 400 });
    const current = await prisma.cmsContentType.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "CMS моделът не е намерен." }, { status: 404 });
    const fields = parseFields(body.fields);
    const contentType = await prisma.$transaction(async (tx) => {
      await tx.cmsContentField.deleteMany({ where: { contentTypeId: id } });
      return tx.cmsContentType.update({
        where: { id },
        data: {
          name: String(body.name ?? current.name).trim(), singularName: String(body.singularName ?? current.singularName).trim(),
          slug: normalizeSlug(body.slug || current.slug), description: String(body.description ?? "").trim(), icon: String(body.icon ?? current.icon).slice(0, 8),
          status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE", updatedById: admin.id,
          fields: { create: fields },
        },
        include: { fields: { orderBy: { position: "asc" } }, _count: { select: { entries: true } } },
      });
    });
    await writeAuditLog({ actorId: admin.id, action: "CMS_CONTENT_TYPE_UPDATED", entityType: "CmsContentType", entityId: id, description: `Редактиран е CMS модел „${contentType.name}“.` });
    return NextResponse.json({ contentType });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CMS моделът не беше редактиран." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  try {
    const admin = await requireAnyAdminPermissionApi(["CMS:DELETE"]);
    if (!admin) return NextResponse.json({ error: "Нямате право за изтриване на CMS модели." }, { status: 403 });
    await ensureCmsSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Невалиден CMS модел." }, { status: 400 });
    const contentType = await prisma.cmsContentType.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
    if (!contentType) return NextResponse.json({ error: "CMS моделът не е намерен." }, { status: 404 });
    if (contentType.isSystem) return NextResponse.json({ error: "Системен CMS модел не може да бъде изтрит." }, { status: 409 });
    if (contentType._count.entries > 0) return NextResponse.json({ error: "Моделът съдържа записи. Първо архивирайте или изтрийте съдържанието." }, { status: 409 });
    await prisma.cmsContentType.delete({ where: { id } });
    await writeAuditLog({ actorId: admin.id, action: "CMS_CONTENT_TYPE_DELETED", entityType: "CmsContentType", entityId: id, description: `Изтрит е CMS модел „${contentType.name}“.` });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CMS content type DELETE failed", error);
    return NextResponse.json({ error: "CMS моделът не беше изтрит поради сървърна грешка." }, { status: 500 });
  }
}
