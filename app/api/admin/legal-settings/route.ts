/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

const keys = ["companyName","companyId","vatNumber","registeredAddress","correspondenceAddress","contactEmail","contactPhone","representativeName","websiteUrl","complaintsEmail","returnsAddress"] as const;

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("LEGAL_SETTINGS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямате право за редакция." }, { status: 403 });

  try {
    const body = await request.json();
    const isVatRegistered = body.isVatRegistered === true;
    const rawRate = Number(String(body.defaultVatRate ?? "20").replace(",", "."));
    const defaultVatRate = Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 100 ? rawRate : 20;
    const vatNumber = typeof body.vatNumber === "string" ? body.vatNumber.trim() : "";

    if (isVatRegistered && !vatNumber) {
      return NextResponse.json({ error: "При регистрация по ЗДДС е необходимо да въведете ДДС номер." }, { status: 400 });
    }

    const data = Object.fromEntries(keys.map((key) => [
      key,
      key === "vatNumber"
        ? (isVatRegistered ? vatNumber || null : null)
        : typeof body[key] === "string" ? body[key].trim() || null : null,
    ]));

    await (prisma as any).legalSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data, isVatRegistered, defaultVatRate },
      update: { ...data, isVatRegistered, defaultVatRate },
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "LEGAL_SETTINGS_UPDATED",
      entityType: "LegalSettings",
      entityId: 1,
      description: `Фирмените данни са обновени. ЗДДС режим: ${isVatRegistered ? `регистрирана (${defaultVatRate}%)` : "нерегистрирана"}.`,
      metadata: { isVatRegistered, defaultVatRate },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("legal settings update", error);
    return NextResponse.json({ error: "Данните не можаха да бъдат записани." }, { status: 500 });
  }
}
