-- Persist marketing integration settings in PostgreSQL instead of the ephemeral/read-only
-- application filesystem used by serverless deployments.
CREATE TABLE IF NOT EXISTS "MarketingIntegrationSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingIntegrationSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketingIntegrationSettings_singleton_check" CHECK ("id" = 1)
);
