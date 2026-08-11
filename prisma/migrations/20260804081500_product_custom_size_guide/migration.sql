ALTER TABLE "Product"
ADD COLUMN "customSizeGuide" JSONB,
ADD COLUMN "hasCustomSizing" BOOLEAN NOT NULL DEFAULT false;
