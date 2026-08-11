import "server-only";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";
import { detectSupportFileMime } from "@/lib/image-mime";

export const SUPPORT_MAX_FILES = 10;
export const SUPPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const SUPPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const allowed = new Set([
  "image/jpeg","image/png","image/webp","image/heic",
  "application/pdf","application/zip","application/x-zip-compressed",
]);

export type UploadedSupportFile = {
  fileName: string; mimeType: string; size: number; url: string; publicId: string; resourceType: string;
};

function normalizedMimeType(value: string) {
  return value === "application/x-zip-compressed" ? "application/zip" : value;
}

export async function deleteUploadedSupportFiles(files: UploadedSupportFile[]) {
  const results = await Promise.allSettled(files.map((file) => getCloudinary().uploader.destroy(file.publicId, {
    resource_type: file.resourceType === "raw" ? "raw" : "image",
    invalidate: true,
  })));
  for (const result of results) {
    if (result.status === "rejected") console.error("Support attachment cleanup failed.");
  }
}

function uploadOne(buffer: Buffer, file: File) {
  const image = file.type.startsWith("image/");
  return new Promise<{ secure_url: string; public_id: string; resource_type: string }>((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream({
      folder: getCloudinaryFolder("support"),
      resource_type: image ? "image" : "raw",
      use_filename: true,
      unique_filename: true,
      filename_override: file.name,
    }, (error, result) => {
      if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
      else resolve({ secure_url: result.secure_url, public_id: result.public_id, resource_type: result.resource_type });
    });
    stream.end(buffer);
  });
}

export async function validateAndUploadSupportFiles(files: File[]): Promise<UploadedSupportFile[]> {
  if (files.length > SUPPORT_MAX_FILES) throw new Error(`Можеш да прикачиш максимум ${SUPPORT_MAX_FILES} файла.`);
  if (files.reduce((sum, file) => sum + file.size, 0) > SUPPORT_MAX_TOTAL_BYTES) throw new Error("Общият размер на файловете трябва да е до 50 MB.");
  const validated: Array<{ file: File; buffer: Buffer }> = [];
  for (const file of files) {
    if (file.size > SUPPORT_MAX_FILE_BYTES) throw new Error(`Файлът „${file.name}“ е по-голям от 15 MB.`);
    if (!allowed.has(file.type)) throw new Error(`Неподдържан формат: ${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (detectSupportFileMime(buffer) !== normalizedMimeType(file.type)) {
      throw new Error(`Съдържанието на файл „${file.name}“ не отговаря на заявения формат.`);
    }
    validated.push({ file, buffer });
  }
  const uploaded: UploadedSupportFile[] = [];
  try {
    for (const { file, buffer } of validated) {
      const result = await uploadOne(buffer, file);
      uploaded.push({fileName:file.name,mimeType:file.type,size:file.size,url:result.secure_url,publicId:result.public_id,resourceType:result.resource_type});
    }
  } catch (error) {
    await deleteUploadedSupportFiles(uploaded);
    throw error;
  }
  return uploaded;
}
