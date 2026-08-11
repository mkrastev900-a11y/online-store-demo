import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const before = await prisma.$queryRaw`
    SELECT p."id", p."name", p."sectionId" AS "productSectionId",
           c."id" AS "categoryId", c."name" AS "categoryName", c."sectionId" AS "categorySectionId"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."sectionId" IS DISTINCT FROM c."sectionId"
    ORDER BY p."id"
  `;

  console.log(`Found ${before.length} product/category section mismatch(es).`);
  for (const row of before) console.log(row);

  // Safe recovery rule for legacy categories with no section:
  // if every *explicitly assigned* product section agrees on exactly one section,
  // use that section for the category. Products whose sectionId is NULL are not a
  // conflicting vote; after the category is recovered they are synchronized too.
  const inferredCategories = await prisma.$queryRaw`
    SELECT c."id" AS "categoryId",
           c."name" AS "categoryName",
           MIN(p."sectionId") AS "inferredSectionId",
           COUNT(*)::int AS "productCount",
           COUNT(p."sectionId")::int AS "explicitSectionCount",
           COUNT(DISTINCT p."sectionId")::int AS "distinctExplicitSections"
    FROM "Category" c
    JOIN "Product" p ON p."categoryId" = c."id"
    WHERE c."sectionId" IS NULL
    GROUP BY c."id", c."name"
    HAVING COUNT(p."sectionId") > 0
       AND COUNT(DISTINCT p."sectionId") = 1
  `;

  if (inferredCategories.length > 0) {
    console.log("\nSafe category section inference:");
    for (const row of inferredCategories) console.log(row);

    await prisma.$transaction(async (tx) => {
      for (const row of inferredCategories) {
        await tx.category.update({
          where: { id: row.categoryId },
          data: { sectionId: row.inferredSectionId },
        });
      }

      // Defensive synchronization. The DB trigger also does this, but keeping it
      // here makes the repair correct even before/without the trigger.
      await tx.$executeRaw`
        UPDATE "Product" p
        SET "sectionId" = c."sectionId", "updatedAt" = CURRENT_TIMESTAMP
        FROM "Category" c
        WHERE c."id" = p."categoryId"
          AND c."sectionId" IS NOT NULL
          AND p."sectionId" IS DISTINCT FROM c."sectionId"
      `;
    });
  } else if (before.length > 0) {
    // Categories that already have a section are safe to synchronize directly.
    await prisma.$executeRaw`
      UPDATE "Product" p
      SET "sectionId" = c."sectionId", "updatedAt" = CURRENT_TIMESTAMP
      FROM "Category" c
      WHERE c."id" = p."categoryId"
        AND c."sectionId" IS NOT NULL
        AND p."sectionId" IS DISTINCT FROM c."sectionId"
    `;
  }

  const unresolved = await prisma.$queryRaw`
    SELECT c."id" AS "categoryId", c."name" AS "categoryName",
           COUNT(*)::int AS "productCount",
           COUNT(p."sectionId")::int AS "explicitSectionCount",
           COUNT(DISTINCT p."sectionId")::int AS "distinctExplicitSections",
           ARRAY_AGG(DISTINCT p."sectionId" ORDER BY p."sectionId") FILTER (WHERE p."sectionId" IS NOT NULL) AS "explicitSectionIds"
    FROM "Category" c
    JOIN "Product" p ON p."categoryId" = c."id"
    WHERE c."sectionId" IS NULL
    GROUP BY c."id", c."name"
    HAVING COUNT(p."sectionId") = 0 OR COUNT(DISTINCT p."sectionId") <> 1
    ORDER BY c."id"
  `;

  if (unresolved.length > 0) {
    console.error("\nManual review is still required for categories with no unique recoverable section:");
    for (const row of unresolved) console.error(row);
  }

  const after = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "count"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."sectionId" IS DISTINCT FROM c."sectionId"
  `;
  console.log(`\nRemaining mismatches: ${after[0]?.count ?? 0}`);
  if ((after[0]?.count ?? 0) > 0 || unresolved.length > 0) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
