import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { writeAuditLog } from "@/lib/audit";
import { ensureCmsSchema } from "@/lib/cms-schema";
import { prisma } from "@/lib/prisma";

import { isSameOriginRequest } from "@/lib/request-security";

const STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

function normalizeSlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

function isBlank(value: unknown) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

async function getType(id: number) {
  return prisma.cmsContentType.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: "asc" } } },
  });
}

type CmsFieldShape = { key: string; name: string; isRequired: boolean; isUnique: boolean };

async function validateEntry(contentTypeId: number, fields: CmsFieldShape[], data: Record<string, unknown>, excludeId?: number) {
  for (const field of fields) {
    const value = data[field.key];
    if (field.isRequired && isBlank(value)) throw new Error(`Полето „${field.name}“ е задължително.`);
    if (field.isUnique && !isBlank(value)) {
      const candidates = await prisma.cmsContentEntry.findMany({
        where: { contentTypeId, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true, data: true },
      });
      const duplicate = candidates.some((entry) => {
        const entryData = entry.data && typeof entry.data === "object" && !Array.isArray(entry.data) ? entry.data as Record<string, unknown> : {};
        return JSON.stringify(entryData[field.key]) === JSON.stringify(value);
      });
      if (duplicate) throw new Error(`Стойността в „${field.name}“ трябва да бъде уникална.`);
    }
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAnyAdminPermissionApi(["CMS:VIEW"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за преглед на CMS съдържание." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const { id: rawId } = await context.params;
    const contentTypeId = Number(rawId);
    if (!Number.isInteger(contentTypeId)) return NextResponse.json({ error: "Невалиден CMS модел." }, { status: 400 });
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") ?? "").trim();
    const status = String(url.searchParams.get("status") ?? "ALL").toUpperCase();
    const contentType = await getType(contentTypeId);
    if (!contentType) return NextResponse.json({ error: "CMS моделът не е намерен." }, { status: 404 });
    const entries = await prisma.cmsContentEntry.findMany({
      where: {
        contentTypeId,
        ...(STATUSES.has(status) ? { status } : {}),
        ...(query ? { OR: [{ title: { contains: query } }, { slug: { contains: query } }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ contentType, entries });
  } catch (error) {
    console.error("CMS entries GET failed", error);
    return NextResponse.json({ error: "CMS съдържанието не може да бъде заредено." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["CMS:CREATE"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за създаване на CMS съдържание." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const { id: rawId } = await context.params;
    const contentTypeId = Number(rawId);
    const contentType = await getType(contentTypeId);
    if (!contentType) return NextResponse.json({ error: "CMS моделът не е намерен." }, { status: 404 });
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const slug = normalizeSlug(body.slug || title);
    const status = STATUSES.has(String(body.status).toUpperCase()) ? String(body.status).toUpperCase() : "DRAFT";
    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {};
    if (title.length < 2 || slug.length < 2) return NextResponse.json({ error: "Попълнете валидни заглавие и slug." }, { status: 400 });
    await validateEntry(contentTypeId, contentType.fields, data);
    const entry = await prisma.cmsContentEntry.create({
      data: {
        contentTypeId, title, slug, status, data: jsonValue(data), seo: jsonValue(body.seo),
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        createdById: admin.id, updatedById: admin.id,
      },
    });
    await writeAuditLog({ actorId: admin.id, action: "CMS_ENTRY_CREATED", entityType: "CmsContentEntry", entityId: entry.id, description: `Създаден е CMS запис „${title}“ в „${contentType.name}“.` });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Slug вече се използва в този CMS модел." : error instanceof Error ? error.message : "CMS записът не беше създаден.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["CMS:EDIT", "CMS:PUBLISH"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за редакция на CMS съдържание." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const { id: rawId } = await context.params;
    const contentTypeId = Number(rawId);
    const body = await request.json();
    const id = Number(body.id);
    const current = await prisma.cmsContentEntry.findFirst({ where: { id, contentTypeId } });
    const contentType = await getType(contentTypeId);
    if (!current || !contentType) return NextResponse.json({ error: "CMS записът не е намерен." }, { status: 404 });
    const title = String(body.title ?? current.title).trim();
    const slug = normalizeSlug(body.slug || current.slug);
    const status = STATUSES.has(String(body.status).toUpperCase()) ? String(body.status).toUpperCase() : current.status;
    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {};
    await validateEntry(contentTypeId, contentType.fields, data, id);
    const entry = await prisma.cmsContentEntry.update({
      where: { id },
      data: {
        title, slug, status, data: jsonValue(data), seo: jsonValue(body.seo), updatedById: admin.id,
        publishedAt: status === "PUBLISHED" ? current.publishedAt ?? new Date() : null,
      },
    });
    await writeAuditLog({ actorId: admin.id, action: status === "PUBLISHED" ? "CMS_ENTRY_PUBLISHED" : "CMS_ENTRY_UPDATED", entityType: "CmsContentEntry", entityId: id, description: `Обновен е CMS запис „${title}“ в „${contentType.name}“.` });
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Slug вече се използва в този CMS модел." : error instanceof Error ? error.message : "CMS записът не беше редактиран.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["CMS:DELETE"]);
  if (!admin) return NextResponse.json({ error: "Нямате право за изтриване на CMS съдържание." }, { status: 403 });
  try {
    await ensureCmsSchema();
    const { id: rawId } = await context.params;
    const contentTypeId = Number(rawId);
    const id = Number(new URL(request.url).searchParams.get("entryId"));
    const entry = await prisma.cmsContentEntry.findFirst({ where: { id, contentTypeId } });
    if (!entry) return NextResponse.json({ error: "CMS записът не е намерен." }, { status: 404 });
    await prisma.cmsContentEntry.delete({ where: { id } });
    await writeAuditLog({ actorId: admin.id, action: "CMS_ENTRY_DELETED", entityType: "CmsContentEntry", entityId: id, description: `Изтрит е CMS запис „${entry.title}“.` });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CMS entry DELETE failed", error);
    return NextResponse.json({ error: "CMS записът не беше изтрит." }, { status: 500 });
  }
}
