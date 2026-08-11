/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";

import { isSameOriginRequest } from "@/lib/request-security";

const guideInclude = {
  measurements: { orderBy: { sortOrder: "asc" as const } },
  sizes: { orderBy: { sortOrder: "asc" as const }, include: { values: { orderBy: { measurementId: "asc" as const } } } },
  _count: { select: { products: true } },
};


function normalizeSizeLabel(raw: unknown): string {
  return String(raw ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

const MAX_SIZE_VALUE_LENGTH = 80;

type IncomingSizeRow = {
  id?: unknown;
  label?: unknown;
  values?: unknown;
  [key: string]: unknown;
};

type ExistingSizeRecord = {
  id: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type SizePlan = {
  incoming: IncomingSizeRow;
  index: number;
  old: ExistingSizeRecord | undefined;
  label: string;
};

function normalizeMeasurementValue(raw: unknown): string | null {
  if (raw === "" || raw == null) return null;
  const normalized = String(raw).normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length > MAX_SIZE_VALUE_LENGTH) throw new Error("SIZE_VALUE_TOO_LONG");
  return normalized;
}

function numericCompatibilityValue(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99_999_999.99) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function measurementData(m: any, index: number, usedKeys?: Set<string>) {
  const explicitKey = String(m?.key ?? "").trim();
  const labelKey = String(m?.label ?? "").toLowerCase().replace(/[^a-z0-9а-я]+/gi, "_").replace(/^_+|_+$/g, "") || "measurement";
  const baseKey = explicitKey || `m_${labelKey}`;
  let key = baseKey;
  let suffix = 2;
  while (usedKeys?.has(key)) key = `${baseKey}_${suffix++}`;
  usedKeys?.add(key);
  return {
    key,
    label: String(m.label ?? "").trim(),
    marker: String(m.marker ?? String.fromCharCode(65 + index)),
    unit: "cm",
    sortOrder: index,
    startX: Number.isFinite(Number(m.startX)) ? Number(m.startX) : 24,
    startY: Number.isFinite(Number(m.startY)) ? Number(m.startY) : 30 + index * 7,
    endX: Number.isFinite(Number(m.endX)) ? Number(m.endX) : 76,
    endY: Number.isFinite(Number(m.endY)) ? Number(m.endY) : 30 + index * 7,
  };
}

function incomingValue(row: any, measurement: { id: number; key: string }, index: number): unknown {
  const values = row?.values;
  if (Array.isArray(values)) {
    const structured = values.find((item: any) => item && typeof item === "object" && (
      Number(item.measurementId) === measurement.id ||
      (String(item.measurementKey ?? "") !== "" && String(item.measurementKey) === measurement.key)
    ));
    if (structured) return structured.value;
    const positional = values[index];
    return positional && typeof positional === "object" && "value" in positional ? positional.value : positional;
  }
  if (values && typeof values === "object") {
    return values[String(measurement.id)] ?? values[measurement.key] ?? null;
  }
  return null;
}

function valueIsEmpty(raw: unknown): boolean {
  const value = raw && typeof raw === "object" && "value" in (raw as any) ? (raw as any).value : raw;
  return value == null || String(value).trim() === "";
}

function validatePayload(body: any) {
  const name = String(body.name ?? "").trim();
  const garmentType = String(body.garmentType ?? "TSHIRT").trim();
  const measurements = (Array.isArray(body.measurements) ? body.measurements : [])
    .filter((item: any) => String(item?.label ?? "").trim());
  const rawSizes = Array.isArray(body.sizes) ? body.sizes : [];
  const sizes = rawSizes.filter((row: any) => {
    const label = normalizeSizeLabel(row?.label);
    const values = Array.isArray(row?.values) ? row.values : Object.values(row?.values ?? {});
    return Boolean(label) || values.some((value: unknown) => !valueIsEmpty(value));
  });

  if (!name) throw new Error("MISSING_GUIDE_NAME");
  if (!measurements.length) throw new Error("MISSING_MEASUREMENTS");
  if (!sizes.length) throw new Error("MISSING_SIZES");
  if (sizes.some((row: any) => !normalizeSizeLabel(row.label))) throw new Error("MISSING_SIZE_LABEL");

  const labels = new Map<string, string>();
  for (const row of sizes) {
    const label = normalizeSizeLabel(row.label);
    const normalizedLabel = label.toLocaleLowerCase("bg-BG");
    if (labels.has(normalizedLabel)) throw new Error(`DUPLICATE_SIZE_LABEL:${label}`);
    labels.set(normalizedLabel, label);
    const values = Array.isArray(row.values) ? row.values : Object.values(row.values ?? {});
    for (const raw of values) normalizeMeasurementValue(raw && typeof raw === "object" && "value" in (raw as any) ? (raw as any).value : raw);
  }
  return { name, garmentType, measurements, sizes };
}

function serializeGuide(guide: any) {
  return {
    ...guide,
    measurements: guide.measurements.map((item: any) => ({ ...item })),
    sizes: guide.sizes.map((size: any) => ({
      ...size,
      values: size.values.map((value: any) => ({
        ...value,
        value: value.valueText ?? (value.value == null ? null : value.value.toString()),
      })),
    })),
  };
}

async function readGuide(id: number) {
  const guide = await prisma.sizeGuide.findUniqueOrThrow({ where: { id }, include: guideInclude });
  return serializeGuide(guide);
}

export async function GET() {
  const admin = await requireAdminPermissionApi("PRODUCTS:VIEW");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  const guides = await prisma.sizeGuide.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: guideInclude });
  return NextResponse.json({ guides: guides.map(serializeGuide) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:CREATE");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  try {
    const body = await request.json();
    const { name, garmentType, measurements, sizes } = validatePayload(body);
    const guideId = await prisma.$transaction(async (tx) => {
      const created = await tx.sizeGuide.create({ data: {
        name, garmentType, description: String(body.description ?? "").trim(), instructions: String(body.instructions ?? "").trim(),
        showDiagram: body.showDiagram !== false, isActive: body.isActive !== false,
      }});
      const usedMeasurementKeys = new Set<string>();
      const measurementRows = measurements.map((measurement: any, index: number) => ({
        sizeGuideId: created.id,
        ...measurementData(measurement, index, usedMeasurementKeys),
      }));
      const createdMeasurements = (await tx.sizeGuideMeasurement.createManyAndReturn({
        data: measurementRows,
      })).sort((a, b) => a.sortOrder - b.sortOrder);

      const sizeRows = sizes.map((row: any, index: number) => ({
        sizeGuideId: created.id,
        label: normalizeSizeLabel(row.label),
        sortOrder: index,
      }));
      const createdSizes = (await tx.sizeGuideSize.createManyAndReturn({
        data: sizeRows,
      })).sort((a, b) => a.sortOrder - b.sortOrder);

      const valueRows = createdSizes.flatMap((size, sizeIndex) => {
        const row = sizes[sizeIndex];
        return createdMeasurements.map((measurement, measurementIndex) => {
          const valueText = normalizeMeasurementValue(incomingValue(row, measurement, measurementIndex));
          return {
            sizeId: size.id,
            measurementId: measurement.id,
            valueText,
            value: numericCompatibilityValue(valueText),
          };
        });
      });
      if (valueRows.length) await tx.sizeGuideValue.createMany({ data: valueRows });

      return created.id;
    }, { maxWait: 5_000, timeout: 15_000 });
    return NextResponse.json({ guide: await readGuide(guideId) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return payloadError(error, "Размерната таблица не беше създадена.");
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Невалиден запис." }, { status: 400 });
    const hasFullPayload = Array.isArray(body.measurements) || Array.isArray(body.sizes) || body.name !== undefined || body.garmentType !== undefined;
    if (!hasFullPayload) {
      await prisma.sizeGuide.update({ where: { id }, data: { showDiagram: body.showDiagram !== false } });
      return NextResponse.json({ guide: await readGuide(id) });
    }

    const { name, garmentType, measurements, sizes } = validatePayload(body);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.sizeGuide.findUniqueOrThrow({
        where: { id },
        include: {
          measurements: true,
          sizes: { include: { values: true } },
        },
      });

      await tx.sizeGuide.update({ where: { id }, data: {
        name, garmentType, description: String(body.description ?? "").trim(), instructions: String(body.instructions ?? "").trim(),
        showDiagram: body.showDiagram !== false, isActive: body.isActive !== false,
      }});

      const existingMeasurements = new Map(existing.measurements.map((item) => [item.id, item]));
      const existingSizes = new Map(existing.sizes.map((item) => [item.id, item]));
      const incomingMeasurementIds = new Set(
        measurements.map((item: any) => Number(item?.id)).filter((value: number) => Number.isInteger(value) && existingMeasurements.has(value)),
      );
      const incomingSizeIds = new Set(
        sizes.map((item: any) => Number(item?.id)).filter((value: number) => Number.isInteger(value) && existingSizes.has(value)),
      );

      const removedMeasurementIds = existing.measurements.filter((item) => !incomingMeasurementIds.has(item.id)).map((item) => item.id);
      const removedSizeIds = existing.sizes.filter((item) => !incomingSizeIds.has(item.id)).map((item) => item.id);

      if (removedMeasurementIds.length) {
        await tx.sizeGuideMeasurement.deleteMany({ where: { id: { in: removedMeasurementIds }, sizeGuideId: id } });
      }
      if (removedSizeIds.length) {
        await tx.sizeGuideSize.deleteMany({ where: { id: { in: removedSizeIds }, sizeGuideId: id } });
      }

      const keptMeasurementKeys = new Set(
        existing.measurements
          .filter((item) => incomingMeasurementIds.has(item.id))
          .map((item) => item.key),
      );
      const persistedMeasurements: Array<{ id: number; key: string }> = [];

      for (let index = 0; index < measurements.length; index += 1) {
        const incoming = measurements[index] as any;
        const incomingId = Number(incoming?.id);
        const old = Number.isInteger(incomingId) ? existingMeasurements.get(incomingId) : undefined;

        if (old && incomingMeasurementIds.has(old.id)) {
          const next = measurementData({ ...incoming, key: old.key }, index);
          const changed =
            old.label !== next.label ||
            old.marker !== next.marker ||
            old.unit !== next.unit ||
            old.sortOrder !== next.sortOrder ||
            old.startX !== next.startX ||
            old.startY !== next.startY ||
            old.endX !== next.endX ||
            old.endY !== next.endY;
          if (changed) {
            await tx.sizeGuideMeasurement.update({
              where: { id: old.id },
              data: {
                label: next.label,
                marker: next.marker,
                unit: next.unit,
                sortOrder: next.sortOrder,
                startX: next.startX,
                startY: next.startY,
                endX: next.endX,
                endY: next.endY,
              },
            });
          }
          persistedMeasurements.push({ id: old.id, key: old.key });
          continue;
        }

        const next = measurementData(incoming, index, keptMeasurementKeys);
        const created = await tx.sizeGuideMeasurement.create({
          data: { sizeGuideId: id, ...next },
          select: { id: true, key: true },
        });
        persistedMeasurements.push(created);
      }

      // Освобождаваме временно старите labels само за редовете, които реално се преименуват.
      // Така размяна EU 38 <-> EU 40 не удря unique constraint.
      const sizePlans: SizePlan[] = (sizes as IncomingSizeRow[]).map((incoming, index) => {
        const incomingId = Number(incoming?.id);
        const old = Number.isInteger(incomingId)
          ? (existingSizes.get(incomingId) as ExistingSizeRecord | undefined)
          : undefined;
        return { incoming, index, old, label: normalizeSizeLabel(incoming.label) };
      });
      const renamedExisting = sizePlans.filter((plan: SizePlan) => plan.old && plan.old.label !== plan.label);
      for (const plan of renamedExisting) {
        await tx.sizeGuideSize.update({
          where: { id: plan.old!.id },
          data: { label: `__tmp_${id}_${plan.old!.id}_${Date.now()}` },
        });
      }

      const persistedSizes: Array<{ id: number; label: string }> = [];
      for (const plan of sizePlans) {
        if (plan.old && incomingSizeIds.has(plan.old.id)) {
          const changed = plan.old.label !== plan.label || plan.old.sortOrder !== plan.index || plan.old.isActive !== true;
          if (changed) {
            await tx.sizeGuideSize.update({
              where: { id: plan.old.id },
              data: { label: plan.label, sortOrder: plan.index, isActive: true },
            });
          }
          persistedSizes.push({ id: plan.old.id, label: plan.label });
          continue;
        }

        const created = await tx.sizeGuideSize.create({
          data: { sizeGuideId: id, label: plan.label, sortOrder: plan.index, isActive: true },
          select: { id: true, label: true },
        });
        persistedSizes.push(created);
      }

      const oldValues = new Map<number, { id: number; sizeId: number; measurementId: number; valueText: string | null; value: any }>();
      for (const size of existing.sizes) {
        for (const value of size.values) oldValues.set(value.id, value);
      }
      const oldValueByPair = new Map<string, { id: number; valueText: string | null; value: any }>();
      for (const value of oldValues.values()) {
        oldValueByPair.set(`${value.sizeId}:${value.measurementId}`, value);
      }

      const createValues: Array<{ sizeId: number; measurementId: number; valueText: string | null; value: number | null }> = [];
      for (let sizeIndex = 0; sizeIndex < persistedSizes.length; sizeIndex += 1) {
        const persistedSize = persistedSizes[sizeIndex];
        const incomingRow = sizes[sizeIndex];
        for (let measurementIndex = 0; measurementIndex < persistedMeasurements.length; measurementIndex += 1) {
          const persistedMeasurement = persistedMeasurements[measurementIndex];
          const valueText = normalizeMeasurementValue(incomingValue(incomingRow, persistedMeasurement, measurementIndex));
          const numericValue = numericCompatibilityValue(valueText);
          const old = oldValueByPair.get(`${persistedSize.id}:${persistedMeasurement.id}`);

          if (!old) {
            createValues.push({
              sizeId: persistedSize.id,
              measurementId: persistedMeasurement.id,
              valueText,
              value: numericValue,
            });
            continue;
          }

          const oldText = old.valueText ?? (old.value == null ? null : old.value.toString());
          const oldNumeric = old.value == null ? null : Number(old.value);
          const sameNumeric = oldNumeric === numericValue || (oldNumeric != null && numericValue != null && Math.abs(oldNumeric - numericValue) < 0.000001);
          if (oldText !== valueText || !sameNumeric) {
            await tx.sizeGuideValue.update({
              where: { id: old.id },
              data: { valueText, value: numericValue },
            });
          }
        }
      }
      if (createValues.length) await tx.sizeGuideValue.createMany({ data: createValues });
    }, { maxWait: 5_000, timeout: 15_000 });

    return NextResponse.json({ guide: await readGuide(id) });
  } catch (error) {
    console.error(error);
    return payloadError(error, "Размерната таблица не беше запазена.");
  }
}

function payloadError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message === "MISSING_GUIDE_NAME") return NextResponse.json({ error: "Въведи име на размерната таблица." }, { status: 400 });
  if (message === "MISSING_MEASUREMENTS") return NextResponse.json({ error: "Добави поне едно измерване." }, { status: 400 });
  if (message === "MISSING_SIZES") return NextResponse.json({ error: "Добави поне един EU размер." }, { status: 400 });
  if (message === "MISSING_SIZE_LABEL") return NextResponse.json({ error: "Всеки попълнен ред трябва да има EU размер." }, { status: 400 });
  if (message.startsWith("DUPLICATE_SIZE_LABEL:")) return NextResponse.json({ error: `Размерът „${message.split(":").slice(1).join(":")}“ е добавен повече от веднъж.` }, { status: 409 });
  if (message === "SIZE_VALUE_TOO_LONG") return NextResponse.json({ error: "Стойността е прекалено дълга. Използвай до 80 символа." }, { status: 400 });
  const prismaError = error as { code?: string; message?: string; meta?: { target?: string[] } };
  if (prismaError?.code === "P2002" && prismaError.meta?.target?.includes("label")) {
    return NextResponse.json({ error: "Има два еднакви EU размера в таблицата. Всеки размер трябва да бъде уникален." }, { status: 409 });
  }
  if (String(prismaError?.message ?? "").toLowerCase().includes("numeric field overflow")) {
    return NextResponse.json({ error: "Някоя стойност е прекалено голяма за размерната таблица. Намали стойността и опитай отново." }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("PRODUCTS:DELETE");
  if (!admin) return NextResponse.json({ error: "Нямаш достъп." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Невалиден запис." }, { status: 400 });
  const used = await prisma.product.count({ where: { sizeGuideId: id } });
  if (used) return NextResponse.json({ error: `Таблицата се използва от ${used} продукта. Първо я откачи или деактивирай.` }, { status: 409 });
  await prisma.sizeGuide.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
