import { NextResponse } from "next/server";
import { deleteAdministratorAccount } from "@/lib/admin-users";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:MANAGE");
  if (!admin) return NextResponse.json({ error: "Нямаш право да изтриваш администраторски акаунти." }, { status: 403 });
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Само главен администратор може да изтрива администраторски акаунти." }, { status: 403 });

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return NextResponse.json({ error: "Невалиден администратор." }, { status: 400 });

  try {
    await deleteAdministratorAccount(userId, admin.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Акаунтът не беше изтрит." }, { status: 400 });
  }
}
