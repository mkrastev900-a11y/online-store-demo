import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  if (!isSameOriginRequest(_)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("CUSTOMERS:TAGS");
  if (!admin) return NextResponse.json({ error: "Нямате право да управлявате CRM тагове." }, { status: 403 });
  const values = await params;
  const customerId = Number(values.id); const tagId = Number(values.tagId);
  if (!Number.isInteger(customerId) || !Number.isInteger(tagId)) return NextResponse.json({ error: "Невалидни данни." }, { status: 400 });
  const assignment = await prisma.customerTagAssignment.findUnique({ where: { customerId_tagId: { customerId, tagId } }, include: { tag: true, customer: { select: { name:true } } } });
  if (!assignment) return NextResponse.json({ error: "Тагът не е намерен." }, { status: 404 });
  await prisma.customerTagAssignment.delete({ where: { customerId_tagId: { customerId, tagId } } });
  await writeAuditLog({ actorId: admin.id, action: "CRM_TAG_REMOVED", entityType: "User", entityId: customerId, description: `${admin.name} премахна таг „${assignment.tag.name}“ от ${assignment.customer.name}.` });
  return NextResponse.json({ ok: true });
}
