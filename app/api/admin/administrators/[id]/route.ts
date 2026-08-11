import { NextResponse } from "next/server";
import {
  demoteAdministratorToCustomer,
  demoteSuperAdminToAdministrator,
  promoteAdministratorToSuperAdmin,
} from "@/lib/admin-users";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:MANAGE");
  if (!admin) return NextResponse.json({ error: "Нямаш право да променяш административното ниво." }, { status: 403 });
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Само главен администратор може да повишава или понижава главни администратори." }, { status: 403 });

  const { id } = await context.params;
  const userId = parseId(id);
  if (!userId) return NextResponse.json({ error: "Невалиден администратор." }, { status: 400 });

  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "promote") {
      const user = await promoteAdministratorToSuperAdmin(userId, admin.id);
      return NextResponse.json({ user });
    }

    if (action === "demote") {
      const user = await demoteSuperAdminToAdministrator(userId, admin.id);
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: "Неподдържано действие." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ролята не беше променена." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("ADMINISTRATORS:MANAGE");
  if (!admin) return NextResponse.json({ error: "Нямаш право да премахваш администраторски права." }, { status: 403 });

  const { id } = await context.params;
  const userId = parseId(id);
  if (!userId) return NextResponse.json({ error: "Невалиден администратор." }, { status: 400 });
  if (userId === admin.id) return NextResponse.json({ error: "Не можеш да премахнеш собствените си права." }, { status: 400 });

  try {
    await demoteAdministratorToCustomer(userId, admin.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Правата не бяха премахнати." },
      { status: 400 },
    );
  }
}
