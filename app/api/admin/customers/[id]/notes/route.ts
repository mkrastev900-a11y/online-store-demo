import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("CUSTOMERS:NOTES");
  if (!admin) return NextResponse.json({ error: "Нямате право да добавяте CRM бележки." }, { status: 403 });
  const customerId = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!Number.isInteger(customerId) || content.length < 2 || content.length > 4000) return NextResponse.json({ error: "Бележката трябва да е между 2 и 4000 символа." }, { status: 400 });
  const customer = await prisma.user.findFirst({ where: { id: customerId, role: "CUSTOMER" }, select: { id:true,name:true } });
  if (!customer) return NextResponse.json({ error: "Клиентът не е намерен." }, { status: 404 });
  const note = await prisma.customerNote.create({ data: { customerId, authorId: admin.id, content }, include: { author: { select: { name:true,email:true } } } });
  await writeAuditLog({ actorId: admin.id, action: "CRM_NOTE_CREATED", entityType: "User", entityId: customerId, description: `${admin.name} добави CRM бележка за ${customer.name}.`, metadata: { noteId: note.id } });
  return NextResponse.json({ note }, { status: 201 });
}
