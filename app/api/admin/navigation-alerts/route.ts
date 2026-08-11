import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin";
import {
  getAdminNavigationAlerts,
  markAdminNavigationAlertViewed,
  markAdminNavigationAlertsViewedBatch,
} from "@/lib/admin-nav-alerts.server";
import { getPermissionKeys } from "@/lib/admin-permissions";
import { getVisibleAdminNavGroups } from "@/lib/admin-navigation";
import { isSameOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Необходим е администраторски достъп." },
      { status: 401 },
    );
  }

  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const permissions = isSuperAdmin ? [] : await getPermissionKeys(admin.id);
  const alerts = await getAdminNavigationAlerts({
    adminId: admin.id,
    isSuperAdmin,
    permissions,
  });

  return NextResponse.json(alerts, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Невалиден източник на заявката." },
      { status: 403 },
    );
  }

  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Необходим е администраторски достъп." },
      { status: 401 },
    );
  }

  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const permissions = isSuperAdmin ? [] : await getPermissionKeys(admin.id);
  const groups = getVisibleAdminNavGroups({ isSuperAdmin, permissions });
  const allowedHrefs = new Set(
    groups.flatMap((group) => group.items.map((item) => item.href)),
  );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Невалидна заявка." },
      { status: 400 },
    );
  }

  if (body && typeof body === "object" && "items" in body && Array.isArray(body.items)) {
    if (body.items.length < 1 || body.items.length > 500) {
      return NextResponse.json({ error: "Невалиден брой известия." }, { status: 400 });
    }
    const items = body.items.map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const href = "href" in raw ? String(raw.href) : "";
      const itemKey = "itemKey" in raw ? String(raw.itemKey) : "";
      const eventVersion = "eventVersion" in raw ? String(raw.eventVersion) : "";
      if (
        href === "/admin" ||
        !allowedHrefs.has(href) ||
        !/^[a-z0-9:_-]{1,100}$/i.test(itemKey) ||
        !eventVersion ||
        eventVersion.length > 200
      ) return null;
      return { href, itemKey, eventVersion };
    });
    if (items.some((item) => item == null)) {
      return NextResponse.json({ error: "Има невалидно известие в заявката." }, { status: 400 });
    }
    try {
      const result = await markAdminNavigationAlertsViewedBatch(
        admin.id,
        items as Array<{ href: string; itemKey: string; eventVersion: string }>,
      );
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Известията не можаха да бъдат маркирани." },
        { status: 503 },
      );
    }
  }

  let href = "";
  let itemKey = "";
  let eventVersion = "";
  if (body && typeof body === "object" && "href" in body) {
    href = String(body.href);
    itemKey = "itemKey" in body ? String(body.itemKey) : "";
    eventVersion = "eventVersion" in body ? String(body.eventVersion) : "";
  }

  if (href === "/admin" || !allowedHrefs.has(href)) {
    return NextResponse.json(
      { error: "Невалидна или недостъпна секция." },
      { status: 400 },
    );
  }

  if (
    !/^[a-z0-9:_-]{1,100}$/i.test(itemKey) ||
    !eventVersion ||
    eventVersion.length > 200
  ) {
    return NextResponse.json(
      { error: "Невалиден идентификатор на новост." },
      { status: 400 },
    );
  }

  try {
    const viewed = await markAdminNavigationAlertViewed(
      admin.id,
      href,
      itemKey,
      eventVersion,
    );
    return NextResponse.json(
      { ok: true, newlyViewed: viewed.newlyViewed, viewed },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Прегледът не можа да бъде записан." },
      { status: 503 },
    );
  }
}
