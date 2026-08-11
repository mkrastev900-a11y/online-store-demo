import { NextResponse } from "next/server";
import { requireAnyAdminPermissionApi } from "@/lib/admin-permissions";
import { writeAuditLog } from "@/lib/audit";
import { detectImageMime } from "@/lib/image-mime";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";

import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const maxFileSize = 8 * 1024 * 1024;

function uploadBuffer(buffer: Buffer, filename: string) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream({
      folder: getCloudinaryFolder("site-design"), resource_type: "image", use_filename: true,
      unique_filename: true, overwrite: false, filename_override: filename,
    }, (error, result) => {
      if (error || !result) reject(error ?? new Error("Cloudinary не върна резултат."));
      else resolve({ secure_url: result.secure_url, public_id: result.public_id });
    });
    stream.end(buffer);
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAnyAdminPermissionApi(["WEB_DESIGN:EDIT"]);
  if (!admin) return NextResponse.json({ error: "Нямате право да качвате файлове за дизайна." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Не е избран файл." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Разрешени са JPG, PNG, WEBP и SVG." }, { status: 400 });
    if (file.size > maxFileSize) return NextResponse.json({ error: "Файлът трябва да е до 8 MB." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.type !== "image/svg+xml" && detectImageMime(buffer) !== file.type) return NextResponse.json({ error: "Съдържанието на файла не отговаря на формата." }, { status: 400 });
    const uploaded = await uploadBuffer(buffer, file.name);
    await writeAuditLog({ actorId: admin.id, action: "SITE_DESIGN_ASSET_UPLOADED", entityType: "SiteDesignAsset", description: "Качен е нов файл за дизайна на магазина.", metadata: { publicId: uploaded.public_id } });
    return NextResponse.json({ url: uploaded.secure_url, publicId: uploaded.public_id });
  } catch (error) {
    console.error("Site design upload error:", error);
    return NextResponse.json({ error: "Файлът не беше качен. Провери Cloudinary настройките." }, { status: 500 });
  }
}
