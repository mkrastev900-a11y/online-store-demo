import { Prisma, type PrismaClient } from "@prisma/client";

import { cleanupDemoDataInTransaction } from "@/lib/demo-data-cleanup-core";
import { getDemoDataTtlMinutes, getProtectedTestAdminEmail, isDemoModeEnabled } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { deleteUploadedSupportFiles } from "@/lib/support-upload";

type DemoCleanupEnvironment = Record<string, string | undefined>;

export class DemoCleanupDisabledError extends Error {
  constructor() {
    super("Demo cleanup is disabled");
    this.name = "DemoCleanupDisabledError";
  }
}

export async function cleanupExpiredDemoData(options: {
  client?: PrismaClient;
  env?: DemoCleanupEnvironment;
  now?: Date;
} = {}) {
  const env = options.env || process.env;
  if (!isDemoModeEnabled(env)) throw new DemoCleanupDisabledError();

  const now = options.now || new Date();
  const ttlMinutes = getDemoDataTtlMinutes(env);
  const cutoff = new Date(now.getTime() - ttlMinutes * 60_000);
  const client = options.client || prisma;
  const result = await client.$transaction(
    (tx) => cleanupDemoDataInTransaction(tx, {
      cutoff,
      now,
      protectedAdminEmail: getProtectedTestAdminEmail(env),
    }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 60_000,
    },
  );

  if (result.attachmentFiles.length) {
    await deleteUploadedSupportFiles(result.attachmentFiles);
  }

  const { attachmentFiles, ...summary } = result;
  return {
    ...summary,
    cutoff: cutoff.toISOString(),
    remoteAttachmentDeletesAttempted: attachmentFiles.length,
    ttlMinutes,
  };
}
