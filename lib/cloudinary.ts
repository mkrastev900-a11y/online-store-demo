import { v2 as cloudinary } from "cloudinary";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Липсва Cloudinary настройка: ${name}`);
  return value;
}

export function getCloudinary() {
  cloudinary.config({
    cloud_name: required("CLOUDINARY_CLOUD_NAME"),
    api_key: required("CLOUDINARY_API_KEY"),
    api_secret: required("CLOUDINARY_API_SECRET"),
    secure: true,
  });
  return cloudinary;
}

export function getCloudinaryFolder(...segments: string[]) {
  const prefix = (process.env.CLOUDINARY_FOLDER_PREFIX?.trim() || "online-store")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "online-store";
  const suffix = segments
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return [prefix, ...suffix].join("/");
}

export function cloudinaryPublicIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;
    const marker = "/upload/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    let value = parsed.pathname.slice(index + marker.length);
    value = value.replace(/^v\d+\//, "");
    value = decodeURIComponent(value).replace(/\.[a-zA-Z0-9]+$/, "");
    return value || null;
  } catch {
    return null;
  }
}

export async function deleteCloudinaryImages(urls: string[]) {
  const publicIds = urls
    .map(cloudinaryPublicIdFromUrl)
    .filter((value): value is string => Boolean(value));

  if (!publicIds.length) return;
  await getCloudinary().api.delete_resources(publicIds, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  });
}

export async function deleteCloudinaryAssets(publicIds: string[], type: "upload" | "authenticated" = "upload") {
  const ids = [...new Set(publicIds.map((value) => value.trim()).filter(Boolean))];
  if (!ids.length) return;
  await getCloudinary().api.delete_resources(ids, {
    resource_type: "image",
    type,
    invalidate: true,
  });
}
