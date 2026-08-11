-- Recover legacy categories whose sectionId is NULL when all explicitly assigned
-- products agree on one section. Products with NULL sectionId are not contradictory;
-- they are synchronized after the category's canonical section is recovered.
WITH inferred AS (
  SELECT p."categoryId", MIN(p."sectionId") AS "sectionId"
  FROM "Product" p
  GROUP BY p."categoryId"
  HAVING COUNT(p."sectionId") > 0
     AND COUNT(DISTINCT p."sectionId") = 1
)
UPDATE "Category" c
SET "sectionId" = i."sectionId"
FROM inferred i
WHERE c."id" = i."categoryId"
  AND c."sectionId" IS NULL
  AND i."sectionId" IS NOT NULL;

-- Defensive synchronization in case the category-update trigger is absent or was
-- created after legacy data was written.
UPDATE "Product" p
SET "sectionId" = c."sectionId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."id" = p."categoryId"
  AND c."sectionId" IS NOT NULL
  AND p."sectionId" IS DISTINCT FROM c."sectionId";
