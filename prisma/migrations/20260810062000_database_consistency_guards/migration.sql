-- Database consistency guards introduced after the full database audit.
-- This migration is additive and safe for an already populated database.

-- Repair cached Product.stock from the actual active variants.
UPDATE "Product" p
SET "stock" = COALESCE(v."stock", 0)
FROM (
  SELECT p2."id" AS "productId", COALESCE(SUM(CASE WHEN pv."isActive" THEN GREATEST(pv."stock", 0) ELSE 0 END), 0)::INTEGER AS "stock"
  FROM "Product" p2
  LEFT JOIN "ProductVariant" pv ON pv."productId" = p2."id"
  GROUP BY p2."id"
) v
WHERE p."id" = v."productId"
  AND p."stock" IS DISTINCT FROM v."stock";

-- Normalize impossible negative counters before adding DB-level guards.
UPDATE "ProductVariant" SET "stock" = 0 WHERE "stock" < 0;
UPDATE "ProductVariant" SET "sold" = 0 WHERE "sold" < 0;
UPDATE "ProductVariant" SET "minStock" = 0 WHERE "minStock" < 0;

-- Quantity rows should never be zero/negative. Existing invalid reservations are safe to remove;
-- order/cart history is preserved and normalized to the minimum valid quantity.
DELETE FROM "InventoryReservation" WHERE "quantity" <= 0;
DELETE FROM "OrderInventoryReservation" WHERE "quantity" <= 0;
UPDATE "CartItem" SET "quantity" = 1 WHERE "quantity" <= 0;
UPDATE "OrderItem" SET "quantity" = 1 WHERE "quantity" <= 0;
UPDATE "SupportRmaItem" SET "quantity" = 1 WHERE "quantity" <= 0;
UPDATE "SupportRmaItem" SET "approvedQuantity" = NULL WHERE "approvedQuantity" IS NOT NULL AND "approvedQuantity" < 0;
UPDATE "SupportRmaItem" SET "approvedQuantity" = "quantity" WHERE "approvedQuantity" IS NOT NULL AND "approvedQuantity" > "quantity";
UPDATE "SupportRmaItem" SET "restockedQuantity" = 0 WHERE "restockedQuantity" < 0;
UPDATE "SupportRmaItem" SET "restockedQuantity" = "quantity" WHERE "restockedQuantity" > "quantity";

-- Idempotent PostgreSQL CHECK constraints. Prisma does not model CHECK constraints, but PostgreSQL enforces them.
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative_chk" CHECK ("stock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonnegative_chk" CHECK ("stock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sold_nonnegative_chk" CHECK ("sold" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_minStock_nonnegative_chk" CHECK ("minStock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive_chk" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_quantity_positive_chk" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderInventoryReservation" ADD CONSTRAINT "OrderInventoryReservation_quantity_positive_chk" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive_chk" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportRmaItem" ADD CONSTRAINT "SupportRmaItem_quantity_positive_chk" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportRmaItem" ADD CONSTRAINT "SupportRmaItem_approved_quantity_chk" CHECK ("approvedQuantity" IS NULL OR ("approvedQuantity" >= 0 AND "approvedQuantity" <= "quantity"));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportRmaItem" ADD CONSTRAINT "SupportRmaItem_restocked_quantity_chk" CHECK ("restockedQuantity" >= 0 AND "restockedQuantity" <= "quantity");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Categories belong to sections. The old global slug uniqueness prevented the same
-- natural category (for example "t-shirts") from existing independently in two sections.
DROP INDEX IF EXISTS "Category_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Category_sectionId_slug_key" ON "Category"("sectionId", "slug");
