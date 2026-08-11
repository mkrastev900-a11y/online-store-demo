import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("CUSTOMERS:TAGS");
  if (!admin) return NextResponse.json({ error: "Нямате право да управлявате CRM тагове." }, { status: 403 });
  const customerId = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!Number.isInteger(customerId) || name.length < 2 || name.length > 40) return NextResponse.json({ error: "Тагът трябва да е между 2 и 40 символа." }, { status: 400 });
  const customer = await prisma.user.findFirst({ where: { id: customerId, role: "CUSTOMER" }, select: { id:true,name:true } });
  if (!customer) return NextResponse.json({ error: "Клиентът не е намерен." }, { status: 404 });
  const tag = await prisma.$transaction(async (tx) => {
    const savedTag = await tx.customerTag.upsert({ where: { name }, update: {}, create: { name } });
    await tx.customerTagAssignment.upsert({
      where: { customerId_tagId: { customerId, tagId: savedTag.id } },
      update: {},
      create: { customerId, tagId: savedTag.id },
    });
    return savedTag;
  });
  await writeAuditLog({ actorId: admin.id, action: "CRM_TAG_ADDED", entityType: "User", entityId: customerId, description: `${admin.name} добави таг „${name}“ на ${customer.name}.`, metadata: { tagId: tag.id, name } });
  return NextResponse.json({ tag }, { status: 201 });
}
