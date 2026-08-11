import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (metadata === undefined) return undefined;

  // Convert Date objects and other serializable values to plain JSON values
  // accepted by Prisma's Json field type.
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: {
  actorId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId == null ? null : String(input.entityId),
        description: input.description,
        metadata: normalizeMetadata(input.metadata),
      },
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}

export async function writeAuditLogTx(
  tx: Prisma.TransactionClient,
  input: {
    actorId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    description: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      description: input.description,
      metadata: normalizeMetadata(input.metadata),
    },
  });
}
