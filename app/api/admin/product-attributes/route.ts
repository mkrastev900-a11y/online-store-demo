import { NextResponse } from "next/server";
import {
  createProductAttribute,
  deleteProductAttribute,
  listProductAttributes,
  updateProductAttribute,
} from "@/lib/admin-product-attributes";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { isSameOriginRequest } from "@/lib/request-security";

export async function GET() {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  return NextResponse.json({ store: await listProductAttributes() });
}

async function canEdit(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямаш право." }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const denied = await canEdit(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json({ store: await createProductAttribute(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Стойността не беше добавена." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await canEdit(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json({ store: await updateProductAttribute(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Стойността не беше коригирана." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await canEdit(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json({ store: await deleteProductAttribute(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Стойността не беше изтрита." }, { status: 400 });
  }
}
