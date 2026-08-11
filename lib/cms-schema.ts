import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let cmsSchemaReady: Promise<void> | null = null;

const CMS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "CmsContentType" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "singularName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "icon" TEXT NOT NULL DEFAULT '▦',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsContentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CmsContentField" (
  "id" SERIAL NOT NULL,
  "contentTypeId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isUnique" BOOLEAN NOT NULL DEFAULT false,
  "isMultiple" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "defaultValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsContentField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CmsContentEntry" (
  "id" SERIAL NOT NULL,
  "contentTypeId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL DEFAULT '{}',
  "seo" JSONB NOT NULL DEFAULT '{}',
  "publishedAt" TIMESTAMP(3),
  "createdById" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsContentEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CmsContentType_slug_key" ON "CmsContentType"("slug");
CREATE INDEX IF NOT EXISTS "CmsContentType_status_updatedAt_idx" ON "CmsContentType"("status", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CmsContentField_contentTypeId_key_key" ON "CmsContentField"("contentTypeId", "key");
CREATE INDEX IF NOT EXISTS "CmsContentField_contentTypeId_position_idx" ON "CmsContentField"("contentTypeId", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "CmsContentEntry_contentTypeId_slug_key" ON "CmsContentEntry"("contentTypeId", "slug");
CREATE INDEX IF NOT EXISTS "CmsContentEntry_contentTypeId_status_updatedAt_idx" ON "CmsContentEntry"("contentTypeId", "status", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CmsContentField_contentTypeId_fkey') THEN
    ALTER TABLE "CmsContentField"
      ADD CONSTRAINT "CmsContentField_contentTypeId_fkey"
      FOREIGN KEY ("contentTypeId") REFERENCES "CmsContentType"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CmsContentEntry_contentTypeId_fkey') THEN
    ALTER TABLE "CmsContentEntry"
      ADD CONSTRAINT "CmsContentEntry_contentTypeId_fkey"
      FOREIGN KEY ("contentTypeId") REFERENCES "CmsContentType"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

export function isMissingCmsSchemaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

export async function ensureCmsSchema() {
  if ((process.env.DATABASE_URL || "").startsWith("file:")) return;
  if (!cmsSchemaReady) {
    cmsSchemaReady = prisma.$executeRawUnsafe(CMS_SCHEMA_SQL).then(() => undefined).catch((error) => {
      cmsSchemaReady = null;
      throw error;
    });
  }
  return cmsSchemaReady;
}
