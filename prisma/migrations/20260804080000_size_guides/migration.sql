CREATE TABLE "SizeGuide" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "garmentType" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "instructions" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SizeGuideMeasurement" (
  "id" SERIAL PRIMARY KEY,
  "sizeGuideId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "marker" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'cm',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SizeGuideMeasurement_sizeGuideId_fkey" FOREIGN KEY ("sizeGuideId") REFERENCES "SizeGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SizeGuideSize" (
  "id" SERIAL PRIMARY KEY,
  "sizeGuideId" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SizeGuideSize_sizeGuideId_fkey" FOREIGN KEY ("sizeGuideId") REFERENCES "SizeGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SizeGuideValue" (
  "id" SERIAL PRIMARY KEY,
  "sizeId" INTEGER NOT NULL,
  "measurementId" INTEGER NOT NULL,
  "value" DECIMAL(10,2),
  CONSTRAINT "SizeGuideValue_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "SizeGuideSize"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SizeGuideValue_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "SizeGuideMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "Product" ADD COLUMN "sizeGuideId" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sizeGuideId_fkey" FOREIGN KEY ("sizeGuideId") REFERENCES "SizeGuide"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SizeGuideMeasurement_sizeGuideId_key_key" ON "SizeGuideMeasurement"("sizeGuideId", "key");
CREATE UNIQUE INDEX "SizeGuideSize_sizeGuideId_label_key" ON "SizeGuideSize"("sizeGuideId", "label");
CREATE UNIQUE INDEX "SizeGuideValue_sizeId_measurementId_key" ON "SizeGuideValue"("sizeId", "measurementId");
CREATE INDEX "SizeGuide_isActive_sortOrder_idx" ON "SizeGuide"("isActive", "sortOrder");
CREATE INDEX "SizeGuideMeasurement_sizeGuideId_sortOrder_idx" ON "SizeGuideMeasurement"("sizeGuideId", "sortOrder");
CREATE INDEX "SizeGuideSize_sizeGuideId_sortOrder_idx" ON "SizeGuideSize"("sizeGuideId", "sortOrder");
CREATE INDEX "SizeGuideValue_measurementId_idx" ON "SizeGuideValue"("measurementId");
CREATE INDEX "Product_sizeGuideId_idx" ON "Product"("sizeGuideId");
