ALTER TABLE "Product" ADD COLUMN "materialComposition" JSONB;

UPDATE "Product"
SET "materialComposition" = jsonb_build_array(jsonb_build_object('material', "material", 'percentage', 100))
WHERE "material" IS NOT NULL AND btrim("material") <> '' AND "materialComposition" IS NULL;
