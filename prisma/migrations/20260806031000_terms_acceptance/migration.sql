ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3), ADD COLUMN "termsVersion" TEXT, ADD COLUMN "termsAcceptanceRequired" BOOLEAN NOT NULL DEFAULT true;
UPDATE "User" SET "termsAcceptanceRequired" = false WHERE "createdAt" < NOW();
