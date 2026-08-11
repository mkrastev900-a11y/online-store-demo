import { NextResponse } from "next/server";
import { listUsersForRoleManagement, promoteExistingUserToAdmin } from "@/lib/admin-users";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET() {
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш право да преглеждаш администраторите." }, { status: 403 });
  return NextResponse.json({ users: await listUsersForRoleManagement() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:MANAGE");
  if (!admin) return NextResponse.json({ error: "Нямаш право да задаваш администраторски права." }, { status: 403 });

  try {
    const body = await request.json();
    const userId = Number(body.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Избери валиден потребителски акаунт." }, { status: 400 });
    }

    const user = await promoteExistingUserToAdmin(userId, admin.id);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Правата не бяха добавени." },
      { status: 400 },
    );
  }
}
