-- Repair legacy Product.sectionId <-> Category.sectionId mismatches and keep the relation coherent.
-- Category.sectionId is the canonical catalog placement. Product.sectionId is a denormalized lookup field.

-- If a legacy category has no section but all of its products already agree on one non-null section,
-- recover the category section from those products first.
WITH inferred AS (
  SELECT p."categoryId", MIN(p."sectionId") AS "sectionId"
  FROM "Product" p
  GROUP BY p."categoryId"
  HAVING COUNT(*) > 0
     AND COUNT(p."sectionId") = COUNT(*)
     AND COUNT(DISTINCT p."sectionId") = 1
)
UPDATE "Category" c
SET "sectionId" = i."sectionId"
FROM inferred i
WHERE c."id" = i."categoryId"
  AND c."sectionId" IS NULL
  AND i."sectionId" IS NOT NULL;

-- Category placement is canonical: synchronize only the denormalized Product.sectionId.
UPDATE "Product" p
SET "sectionId" = c."sectionId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."id" = p."categoryId"
  AND c."sectionId" IS NOT NULL
  AND p."sectionId" IS DISTINCT FROM c."sectionId";

-- A category that already contains products must not be detached from its section.
CREATE OR REPLACE FUNCTION "guard_category_section_with_products"()
RETURNS trigger AS $$
BEGIN
  IF NEW."sectionId" IS NULL
     AND EXISTS (SELECT 1 FROM "Product" p WHERE p."categoryId" = NEW."id") THEN
    RAISE EXCEPTION 'category % has products and cannot have a null section', NEW."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Category_section_required_for_products_guard" ON "Category";
CREATE TRIGGER "Category_section_required_for_products_guard"
BEFORE UPDATE OF "sectionId" ON "Category"
FOR EACH ROW EXECUTE FUNCTION "guard_category_section_with_products"();

-- Keep Product.sectionId synchronized even if Category.sectionId is changed outside the application.
CREATE OR REPLACE FUNCTION "sync_products_after_category_section_change"()
RETURNS trigger AS $$
BEGIN
  IF NEW."sectionId" IS DISTINCT FROM OLD."sectionId" THEN
    UPDATE "Product"
    SET "sectionId" = NEW."sectionId",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "categoryId" = NEW."id"
      AND "sectionId" IS DISTINCT FROM NEW."sectionId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Category_section_sync_products" ON "Category";
CREATE TRIGGER "Category_section_sync_products"
AFTER UPDATE OF "sectionId" ON "Category"
FOR EACH ROW
WHEN (NEW."sectionId" IS NOT NULL AND NEW."sectionId" IS DISTINCT FROM OLD."sectionId")
EXECUTE FUNCTION "sync_products_after_category_section_change"();
