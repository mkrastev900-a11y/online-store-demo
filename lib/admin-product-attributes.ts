import type { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProductTypeFamily = ProductType;
export type ProductAttributeKind = "productTypes" | "colors" | "materials";

export type ProductTypeAttribute = {
  id: string;
  label: string;
  value?: ProductTypeFamily;
  isActive: boolean;
  sortOrder: number;
};

export type SimpleProductAttribute = {
  id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

export type ProductAttributesStore = {
  productTypes: ProductTypeAttribute[];
  colors: SimpleProductAttribute[];
  materials: SimpleProductAttribute[];
  productKinds?: Record<string, string | null>;
};

const DEFAULT_STORE: ProductAttributesStore = {
  productTypes: [
    { id: "t-shirt", label: "Тениска", value: "CLOTHING" as ProductTypeFamily, isActive: true, sortOrder: 10 },
    { id: "dress", label: "Рокля", value: "CLOTHING" as ProductTypeFamily, isActive: true, sortOrder: 20 },
    { id: "pants", label: "Панталон", value: "CLOTHING" as ProductTypeFamily, isActive: true, sortOrder: 30 },
    { id: "sneakers", label: "Маратонки", value: "SHOES" as ProductTypeFamily, isActive: true, sortOrder: 40 },
    { id: "ring", label: "Пръстен", value: "ACCESSORY" as ProductTypeFamily, isActive: true, sortOrder: 50 },
  ],
  colors: [
    { id: "black", label: "Черен", isActive: true, sortOrder: 10 },
    { id: "white", label: "Бял", isActive: true, sortOrder: 20 },
    { id: "red", label: "Червен", isActive: true, sortOrder: 30 },
    { id: "blue", label: "Син", isActive: true, sortOrder: 40 },
  ],
  materials: [
    { id: "cotton", label: "Памук", isActive: true, sortOrder: 10 },
    { id: "polyester", label: "Полиестер", isActive: true, sortOrder: 20 },
    { id: "wool", label: "Вълна", isActive: true, sortOrder: 30 },
    { id: "leather", label: "Кожа", isActive: true, sortOrder: 40 },
  ],
  productKinds: {},
};

function slugify(value: string) {
  return value.trim().toLocaleLowerCase("bg-BG").replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-+|-+$/g, "") || `item-${Date.now()}`;
}

function inferProductTypeFamily(label: string): ProductTypeFamily {
  const normalized = label.toLocaleLowerCase("bg-BG");
  if (/обув|маратон|бот|сандал|чехл|пантоф/.test(normalized)) return "SHOES" as ProductTypeFamily;
  if (/аксесоар|чанта|колан|шапк|шал|ръкавиц|бижу|пръстен|гривн|колие|очил/.test(normalized)) return "ACCESSORY" as ProductTypeFamily;
  return "CLOTHING" as ProductTypeFamily;
}

async function seedDefaultsIfEmpty() {
  const count = await prisma.productAttributeOption.count();
  if (count > 0) return;
  const rows = [
    ...DEFAULT_STORE.productTypes.map((x) => ({ id: x.id, kind: "productTypes", label: x.label, family: x.value ?? inferProductTypeFamily(x.label), isActive: x.isActive, sortOrder: x.sortOrder })),
    ...DEFAULT_STORE.colors.map((x) => ({ id: x.id, kind: "colors", label: x.label, family: null, isActive: x.isActive, sortOrder: x.sortOrder })),
    ...DEFAULT_STORE.materials.map((x) => ({ id: x.id, kind: "materials", label: x.label, family: null, isActive: x.isActive, sortOrder: x.sortOrder })),
  ];
  await Promise.all(
    rows.map((row) =>
      prisma.productAttributeOption.upsert({
        where: { id: row.id },
        update: {},
        create: row,
      }),
    ),
  );
}

export async function listProductAttributes(): Promise<ProductAttributesStore> {
  await seedDefaultsIfEmpty();
  const rows = await prisma.productAttributeOption.findMany({ orderBy: [{ kind: "asc" }, { label: "asc" }] });
  return {
    productTypes: rows.filter((x) => x.kind === "productTypes").map((x) => ({ id: x.id, label: x.label, value: x.family ?? inferProductTypeFamily(x.label), isActive: x.isActive, sortOrder: x.sortOrder })).sort((a,b)=>a.label.localeCompare(b.label,"bg-BG",{sensitivity:"base",numeric:true})),
    colors: rows.filter((x) => x.kind === "colors").map((x) => ({ id: x.id, label: x.label, isActive: x.isActive, sortOrder: x.sortOrder })).sort((a,b)=>a.label.localeCompare(b.label,"bg-BG",{sensitivity:"base",numeric:true})),
    materials: rows.filter((x) => x.kind === "materials").map((x) => ({ id: x.id, label: x.label, isActive: x.isActive, sortOrder: x.sortOrder })).sort((a,b)=>a.label.localeCompare(b.label,"bg-BG",{sensitivity:"base",numeric:true})),
    productKinds: {},
  };
}

export async function getActiveProductAttributes() {
  const store = await listProductAttributes();
  return { productTypes: store.productTypes.filter((x) => x.isActive), colors: store.colors.filter((x) => x.isActive), materials: store.materials.filter((x) => x.isActive) };
}

function assertKind(value: unknown): ProductAttributeKind {
  if (value === "productTypes" || value === "colors" || value === "materials") return value;
  throw new Error("Невалиден вид стойност.");
}

function cleanLabel(value: unknown) {
  const label = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!label) throw new Error("Името не може да бъде празно.");
  if (label.length > 120) throw new Error("Името може да съдържа до 120 символа.");
  return label;
}

async function assertNoDuplicate(kind: ProductAttributeKind, label: string, exceptId?: string) {
  const normalized = label.toLocaleLowerCase("bg-BG");
  const candidates = await prisma.productAttributeOption.findMany({
    where: {
      kind,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, label: true },
  });
  const duplicate = candidates.find((item) => item.label.toLocaleLowerCase("bg-BG") === normalized);
  if (duplicate) throw new Error(`Стойността „${label}“ вече съществува.`);
}

async function uniqueAttributeId(kind: ProductAttributeKind, label: string) {
  const base = `${kind}-${slugify(label)}`.slice(0, 112);
  let candidate = base;
  let index = 2;
  while (await prisma.productAttributeOption.findUnique({ where: { id: candidate }, select: { id: true } })) {
    const suffix = `-${index++}`;
    candidate = `${base.slice(0, Math.max(1, 120 - suffix.length))}${suffix}`;
  }
  return candidate;
}

export async function createProductAttribute(input: { kind?: unknown; label?: unknown }) {
  const kind = assertKind(input.kind);
  const label = cleanLabel(input.label);
  await assertNoDuplicate(kind, label);
  const id = await uniqueAttributeId(kind, label);
  const last = await prisma.productAttributeOption.aggregate({ where: { kind }, _max: { sortOrder: true } });
  await prisma.productAttributeOption.create({
    data: {
      id,
      kind,
      label,
      family: kind === "productTypes" ? inferProductTypeFamily(label) : null,
      isActive: true,
      sortOrder: (last._max.sortOrder ?? 0) + 10,
    },
  });
  return listProductAttributes();
}

export async function updateProductAttribute(input: { id?: unknown; kind?: unknown; label?: unknown; isActive?: unknown }) {
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("Липсва идентификатор на стойността.");
  const kind = assertKind(input.kind);
  const current = await prisma.productAttributeOption.findUnique({ where: { id } });
  if (!current || current.kind !== kind) throw new Error("Стойността не беше намерена.");

  const data: { label?: string; isActive?: boolean; family?: ProductTypeFamily | null } = {};
  if (input.label !== undefined) {
    const label = cleanLabel(input.label);
    await assertNoDuplicate(kind, label, id);
    data.label = label;
    if (kind === "productTypes") data.family = inferProductTypeFamily(label);
  }
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  if (Object.keys(data).length === 0) throw new Error("Няма промяна за запис.");

  await prisma.productAttributeOption.update({ where: { id }, data });
  return listProductAttributes();
}

export async function deleteProductAttribute(input: { id?: unknown; kind?: unknown }) {
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("Липсва идентификатор на стойността.");
  const kind = assertKind(input.kind);
  const current = await prisma.productAttributeOption.findUnique({ where: { id }, select: { id: true, kind: true } });
  if (!current || current.kind !== kind) throw new Error("Стойността не беше намерена.");
  await prisma.productAttributeOption.delete({ where: { id } });
  return listProductAttributes();
}

export async function setStoredProductKind(productId: number, kindLabel: string | null) {
  await prisma.product.update({ where: { id: productId }, data: { productKind: kindLabel?.trim() || null }, select: { id: true } });
}

export async function getStoredProductKind(productId: number): Promise<string | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { productKind: true } });
  return product?.productKind?.trim() || null;
}
