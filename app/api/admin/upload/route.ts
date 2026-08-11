import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { writeAuditLog } from "@/lib/audit";
import { detectImageMime } from "@/lib/image-mime";
import { cloudinaryPublicIdFromUrl, deleteCloudinaryAssets, getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 8 * 1024 * 1024;
const maxImages = 10;
const productFolder = `${getCloudinaryFolder("products")}/`;

function uploadBuffer(buffer: Buffer, filename: string) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(
      {
        folder: getCloudinaryFolder("products"),
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        filename_override: filename,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary не върна резултат."));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:CREATE", "PRODUCTS:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право да качваш продуктови снимки." }, { status: 403 });

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (!files.length) return NextResponse.json({ error: "Не са избрани снимки." }, { status: 400 });
    if (files.length > maxImages) return NextResponse.json({ error: `Можеш да качиш максимум ${maxImages} снимки.` }, { status: 400 });

    const validated: Array<{ file: File; buffer: Buffer }> = [];
    for (const file of files) {
      if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Разрешени са JPG, PNG и WEBP снимки." }, { status: 400 });
      if (file.size > maxFileSize) return NextResponse.json({ error: "Всяка снимка трябва да е до 8 MB." }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      if (detectImageMime(buffer) !== file.type) {
        return NextResponse.json({ error: "Съдържанието на файл не отговаря на заявения формат." }, { status: 400 });
      }
      validated.push({ file, buffer });
    }

    const images: Array<{ url: string; publicId: string }> = [];
    try {
      for (const { file, buffer } of validated) {
        const uploaded = await uploadBuffer(buffer, file.name);
        images.push({ url: uploaded.secure_url, publicId: uploaded.public_id });
      }

      await writeAuditLog({
        actorId: admin.id,
        action: "PRODUCT_IMAGES_UPLOADED",
        entityType: "ProductImage",
        description: `Качени са ${images.length} продуктови снимки.`,
        metadata: { publicIds: images.map((image) => image.publicId) },
      });
    } catch (error) {
      try {
        await deleteCloudinaryAssets(images.map((image) => image.publicId));
      } catch (cleanupError) {
        console.error("Cloudinary cleanup after failed upload failed:", cleanupError);
      }
      throw error;
    }

    return NextResponse.json({ images, urls: images.map((image) => image.url) });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ error: "Снимките не бяха качени в Cloudinary. Провери настройките във Vercel." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["PRODUCTS:EDIT", "PRODUCTS:DELETE"]);
  if (!admin) return NextResponse.json({ error: "Нямаш право да премахваш продуктови снимки." }, { status: 403 });

  try {
    const body = await request.json();
    const url = String(body.url ?? "").trim();
    const publicId = cloudinaryPublicIdFromUrl(url);
    if (!url || !publicId || !publicId.startsWith(productFolder) || !/^[a-zA-Z0-9/_-]+$/.test(publicId)) {
      return NextResponse.json({ error: "Невалидна продуктова Cloudinary снимка." }, { status: 400 });
    }

    const [galleryReference, primaryReference] = await Promise.all([
      prisma.productImage.findFirst({ where: { url }, select: { id: true } }),
      prisma.product.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    ]);
    if (galleryReference || primaryReference) {
      return NextResponse.json({ error: "Снимката още е свързана с продукт и не може да бъде изтрита." }, { status: 409 });
    }

    await getCloudinary().uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
    await writeAuditLog({
      actorId: admin.id,
      action: "PRODUCT_IMAGE_DELETED",
      entityType: "ProductImage",
      description: "Изтрита е несвързана продуктова снимка.",
      metadata: { publicId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return NextResponse.json({ error: "Снимката не беше изтрита от Cloudinary." }, { status: 500 });
  }
}
