CREATE TABLE IF NOT EXISTS "CatalogSection" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "eyebrow" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "baseAudience" "Audience" NOT NULL DEFAULT 'WOMEN',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogSection_slug_key" ON "CatalogSection"("slug");
CREATE INDEX IF NOT EXISTS "CatalogSection_isActive_sortOrder_idx" ON "CatalogSection"("isActive", "sortOrder");
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER;
DO $$ BEGIN
  ALTER TABLE "Category" ADD CONSTRAINT "Category_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Category_sectionId_idx" ON "Category"("sectionId");
CREATE INDEX IF NOT EXISTS "Product_sectionId_idx" ON "Product"("sectionId");
INSERT INTO "CatalogSection" ("name", "slug", "eyebrow", "description", "baseAudience", "isSystem", "sortOrder") VALUES
('Дамско', 'women', 'ДАМСКА МОДА', 'Елегантни и ежедневни модели.', 'WOMEN', true, 10),
('Мъжко', 'men', 'МЪЖКА МОДА', 'Изчистени и удобни мъжки модели.', 'MEN', true, 20),
('Детско', 'kids', 'ДЕТСКА МОДА', 'Практични предложения за деца.', 'KIDS', true, 30)
ON CONFLICT ("slug") DO NOTHING;
UPDATE "Category" c SET "sectionId" = s."id" FROM "CatalogSection" s WHERE c."sectionId" IS NULL AND (
  (s."slug" = 'women' AND EXISTS (SELECT 1 FROM "Product" p WHERE p."categoryId" = c."id" AND p."audience" = 'WOMEN')) OR
  (s."slug" = 'men' AND EXISTS (SELECT 1 FROM "Product" p WHERE p."categoryId" = c."id" AND p."audience" = 'MEN')) OR
  (s."slug" = 'kids' AND EXISTS (SELECT 1 FROM "Product" p WHERE p."categoryId" = c."id" AND p."audience" = 'KIDS'))
);
UPDATE "Product" p SET "sectionId" = COALESCE(c."sectionId", s."id")
FROM "Category" c, "CatalogSection" s
WHERE p."categoryId" = c."id" AND p."sectionId" IS NULL AND (
  (s."slug" = 'women' AND p."audience" = 'WOMEN') OR
  (s."slug" = 'men' AND p."audience" = 'MEN') OR
  (s."slug" = 'kids' AND p."audience" = 'KIDS')
);
