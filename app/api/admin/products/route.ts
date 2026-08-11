import { Audience, ProductType } from "@prisma/client";
import { NextResponse } from "next/server";
import { createAdminProduct, listAdminProducts } from "@/lib/admin-products";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

export async function GET() {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) {
    return NextResponse.json({ error: "Нямаш администраторски достъп." }, { status: 403 });
  }

  return NextResponse.json({ products: await listAdminProducts() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:CREATE");
  if (!admin) {
    return NextResponse.json({ error: "Нямаш администраторски достъп." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const sectionId = Number(body.sectionId);
    const categoryId = Number(body.categoryId);
    const price = Number(body.price);
    const compareAtPrice =
      body.compareAtPrice === "" || body.compareAtPrice == null
        ? null
        : Number(body.compareAtPrice);


    const materialComposition = Array.isArray(body.materialComposition)
      ? body.materialComposition
          .map((item: Record<string, unknown>) => ({
            material: String(item.material ?? "").trim(),
            percentage: Math.round(Number(item.percentage ?? 0)),
          }))
          .filter((item: { material: string; percentage: number }) => item.material && item.percentage > 0)
      : [];
    const materialTotal = materialComposition.reduce((sum: number, item: { percentage: number }) => sum + item.percentage, 0);

    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.map(String).filter(Boolean)
      : [];

    const variants = Array.isArray(body.variants)
      ? body.variants
          .map((variant: Record<string, unknown>) => ({
            size: String(variant.size ?? "").trim(),
            stock: Math.max(0, Math.floor(Number(variant.stock ?? 0))),
          }))
          .filter((variant: { size: string }) => variant.size)
      : [];

    if (name.length < 2) return NextResponse.json({ error: "Въведи име на продукта." }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Добави описание." }, { status: 400 });
    if (!Number.isInteger(sectionId) || sectionId <= 0) return NextResponse.json({ error: "Избери секция." }, { status: 400 });
    if (!Number.isInteger(categoryId) || categoryId <= 0) return NextResponse.json({ error: "Избери категория." }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Въведи валидна цена." }, { status: 400 });
    if (!materialComposition.length || materialTotal !== 100) return NextResponse.json({ error: "Материалният състав трябва да бъде точно 100%." }, { status: 400 });
    if (!imageUrls.length) return NextResponse.json({ error: "Качи поне една снимка." }, { status: 400 });
    if (!variants.length) return NextResponse.json({ error: "Добави поне един размер и наличност." }, { status: 400 });

    const audience = String(body.audience) as Audience;
    const productType = String(body.productType) as ProductType;

    if (!Object.values(Audience).includes(audience)) {
      return NextResponse.json({ error: "Избери секция." }, { status: 400 });
    }

    if (!Object.values(ProductType).includes(productType)) {
      return NextResponse.json({ error: "Избери тип продукт." }, { status: 400 });
    }

    const product = await createAdminProduct({
      name,
      description,
      material: materialComposition.map((item: { material: string; percentage: number }) => `${item.material} ${item.percentage}%`).join(", "),
      materialComposition,
      color: String(body.color ?? "").trim() || null,
      brand: String(body.brand ?? "").trim() || null,
      sectionId,
      categoryId,
      audience,
      productType,
      productKind: String(body.productKind ?? "").trim() || null,
      price,
      compareAtPrice,
      imageUrls,
      variants,
      isNew: Boolean(body.isNew),
      isFeatured: Boolean(body.isFeatured),
      isActive: body.isActive !== false,
      sizeGuideId: Number(body.sizeGuideId) > 0 ? Number(body.sizeGuideId) : null,
      hasCustomSizing: Boolean(body.hasCustomSizing),
      customSizeGuide: body.hasCustomSizing && body.customSizeGuide && typeof body.customSizeGuide === "object" ? body.customSizeGuide : null,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Продуктът не беше създаден." }, { status: 500 });
  }
}
