import { NextResponse } from "next/server";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { getSystemHealthSnapshot } from "@/lib/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminPermissionApi("SYSTEM_HEALTH:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш право да преглеждаш системното здраве." }, { status: 403 });

  try {
    const snapshot = await getSystemHealthSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Проверката не можа да бъде изпълнена." }, { status: 500 });
  }
}
