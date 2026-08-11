import { Audience, ProductType } from "@prisma/client";
import { NextResponse } from "next/server";
import { deleteAdminProduct, getAdminProduct, updateAdminProduct } from "@/lib/admin-products";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

function parse(body: Record<string, unknown>) {
  const materialComposition = Array.isArray(body.materialComposition)
    ? body.materialComposition
        .map((item: Record<string, unknown>) => ({
          material: String(item.material ?? "").trim(),
          percentage: Math.round(Number(item.percentage ?? 0)),
        }))
        .filter((item: { material: string; percentage: number }) => item.material && item.percentage > 0)
    : [];

  return {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim(),
    material: materialComposition.map((item: { material: string; percentage: number }) => `${item.material} ${item.percentage}%`).join(", ") || null,
    materialComposition,
    color: String(body.color ?? "").trim() || null,
    brand: String(body.brand ?? "").trim() || null,
    sectionId: Number(body.sectionId) > 0 ? Number(body.sectionId) : null,
    categoryId: Number(body.categoryId),
    audience: String(body.audience) as Audience,
    productType: String(body.productType) as ProductType,
    productKind: String(body.productKind ?? "").trim() || null,
    price: Number(body.price),
    compareAtPrice:
      body.compareAtPrice === "" || body.compareAtPrice == null
        ? null
        : Number(body.compareAtPrice),
    imageUrls: Array.isArray(body.imageUrls)
      ? body.imageUrls.map(String).filter(Boolean)
      : [],
    variants: Array.isArray(body.variants)
      ? body.variants
          .map((variant: Record<string, unknown>) => ({
            size: String(variant.size ?? "").trim(),
            stock: Math.max(0, Math.floor(Number(variant.stock ?? 0))),
          }))
          .filter((variant: { size: string }) => variant.size)
      : [],
    isNew: Boolean(body.isNew),
    isFeatured: Boolean(body.isFeatured),
    isActive: body.isActive !== false,
    sizeGuideId: Number(body.sizeGuideId) > 0 ? Number(body.sizeGuideId) : null,
    hasCustomSizing: Boolean(body.hasCustomSizing),
    customSizeGuide: body.hasCustomSizing && body.customSizeGuide && typeof body.customSizeGuide === "object" ? body.customSizeGuide : null,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) return NextResponse.json({ error: "Забранено." }, { status: 403 });

  const { id } = await context.params;
  const product = await getAdminProduct(Number(id));
  if (!product) return NextResponse.json({ error: "Не е намерен." }, { status: 404 });

  return NextResponse.json({ product });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:EDIT");
  if (!admin) return NextResponse.json({ error: "Забранено." }, { status: 403 });

  const { id } = await context.params;
  const productId = Number(id);
  const input = parse(await request.json());

  const materialTotal = input.materialComposition.reduce((sum: number, item: { percentage: number }) => sum + item.percentage, 0);
  if (!input.name || !input.description || !input.variants.length || !input.materialComposition.length || materialTotal !== 100) {
    return NextResponse.json(
      { error: materialTotal !== 100 ? "Материалният състав трябва да бъде точно 100%." : "Попълни име, описание и поне един размер с наличност." },
      { status: 400 },
    );
  }

  try {
    const product = await updateAdminProduct(productId, input);
    return NextResponse.json({ product });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Промените не бяха запазени." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:DELETE");
  if (!admin) return NextResponse.json({ error: "Забранено." }, { status: 403 });

  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "Невалиден продукт." }, { status: 400 });
  }

  try {
    const result = await deleteAdminProduct(productId);
    return NextResponse.json({
      success: true,
      ...result,
      message: result.archived
        ? "Продуктът има поръчки и беше скрит вместо окончателно изтрит."
        : "Продуктът е изтрит.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Продуктът не беше изтрит." },
      { status: 400 },
    );
  }
}
