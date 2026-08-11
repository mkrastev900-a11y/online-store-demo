CREATE TABLE IF NOT EXISTS "LegalSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "companyName" TEXT,
  "companyId" TEXT,
  "vatNumber" TEXT,
  "registeredAddress" TEXT,
  "correspondenceAddress" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "representativeName" TEXT,
  "websiteUrl" TEXT,
  "complaintsEmail" TEXT,
  "returnsAddress" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalSettings_pkey" PRIMARY KEY ("id")
);
