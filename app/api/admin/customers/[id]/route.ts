import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

const CRM_STATUSES = ["NEW", "ACTIVE", "VIP", "RISK", "INACTIVE", "BLOCKED"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return NextResponse.json({ error: "Невалиден клиент." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id:true,name:true,email:true,role:true,isActive:true,adminNote:true,crmStatus:true } });
  if (!target || target.role !== "CUSTOMER") return NextResponse.json({ error: "Клиентът не е намерен." }, { status: 404 });
  const data: { adminNote?: string | null; isActive?: boolean; crmStatus?: typeof CRM_STATUSES[number] } = {};
  let admin = null;
  if (typeof body.adminNote === "string") {
    admin = await requireAdminPermissionApi("CUSTOMERS:EDIT");
    if (!admin) return NextResponse.json({ error: "Нямате право за редакция на клиенти." }, { status: 403 });
    data.adminNote = body.adminNote.trim() || null;
  }
  if (typeof body.crmStatus === "string") {
    admin = await requireAdminPermissionApi("CUSTOMERS:STATUS");
    if (!admin) return NextResponse.json({ error: "Нямате право да променяте CRM статус." }, { status: 403 });
    if (!(CRM_STATUSES as readonly string[]).includes(body.crmStatus)) return NextResponse.json({ error: "Невалиден CRM статус." }, { status: 400 });
    data.crmStatus = body.crmStatus as typeof CRM_STATUSES[number];
  }
  if (typeof body.isActive === "boolean") {
    admin = await requireAdminPermissionApi("CUSTOMERS:BLOCK");
    if (!admin) return NextResponse.json({ error: "Нямате право да блокирате или активирате клиенти." }, { status: 403 });
    data.isActive = body.isActive;
    data.crmStatus = body.isActive ? (target.crmStatus === "BLOCKED" ? "ACTIVE" : target.crmStatus) : "BLOCKED";
  }
  if (!admin || !Object.keys(data).length) return NextResponse.json({ error: "Няма валидна промяна." }, { status: 400 });
  const updated = await prisma.user.update({ where: { id: userId }, data, select: { id:true,name:true,email:true,isActive:true,adminNote:true,crmStatus:true } });
  await writeAuditLog({ actorId: admin.id, action: "CRM_CUSTOMER_UPDATED", entityType: "User", entityId: userId, description: `${admin.name} обнови CRM профила на ${target.name}.`, metadata: { before: target, changes: data } });
  return NextResponse.json({ user: updated });
}
