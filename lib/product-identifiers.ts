import { Audience } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const bulgarianMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

function transliterateBulgarian(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((character) => bulgarianMap[character] ?? character)
    .join("");
}

export function createSlugBase(name: string) {
  const slug = transliterateBulgarian(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "product";
}

export async function createUniqueProductSlug(
  name: string,
  excludeProductId?: number,
) {
  const base = createSlugBase(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        slug: candidate,
        ...(excludeProductId
          ? { id: { not: excludeProductId } }
          : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function audienceCode(audience: Audience) {
  if (audience === "WOMEN") return "W";
  if (audience === "MEN") return "M";
  return "K";
}

export async function createUniqueProductSku(audience: Audience) {
  const prefix = `ZZ-${audienceCode(audience)}-`;

  const products = await prisma.product.findMany({
    where: {
      sku: { startsWith: prefix },
    },
    select: { sku: true },
  });

  const highestNumber = products.reduce((highest, product) => {
    const match = product.sku?.match(/(\d{6})$/);
    const current = match ? Number(match[1]) : 0;
    return Math.max(highest, current);
  }, 0);

  let nextNumber = highestNumber + 1;

  while (true) {
    const candidate = `${prefix}${String(nextNumber).padStart(6, "0")}`;

    const existing = await prisma.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    nextNumber += 1;
  }
}

export function createVariantSku(productSku: string, size: string) {
  const sizeCode = size
    .toUpperCase()
    .replace(/^EU\s*/i, "")
    .replace(/[^A-Z0-9]+/g, "");

  return `${productSku}-${sizeCode || "ONE"}`;
}
