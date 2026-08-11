ALTER TABLE "LegalSettings"
  ADD COLUMN IF NOT EXISTS "isVatRegistered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 20.00;

UPDATE "LegalSettings"
SET "isVatRegistered" = CASE
  WHEN NULLIF(BTRIM(COALESCE("vatNumber", '')), '') IS NOT NULL THEN true
  ELSE false
END
WHERE "id" = 1;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "vatRegisteredAtSale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vatRateAtSale" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "taxBaseAtSale" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "vatAmountAtSale" DECIMAL(14,2) NOT NULL DEFAULT 0.00;

-- Backfill legacy orders from the legal VAT mode that existed when this migration was applied.
-- Future orders keep their own immutable snapshot and will no longer change when company VAT settings change.
WITH settings AS (
  SELECT COALESCE("isVatRegistered", false) AS registered,
         COALESCE("defaultVatRate", 20.00) AS rate
  FROM "LegalSettings"
  WHERE "id" = 1
)
UPDATE "Order" o
SET
  "vatRegisteredAtSale" = COALESCE((SELECT registered FROM settings), false),
  "vatRateAtSale" = CASE WHEN COALESCE((SELECT registered FROM settings), false) THEN COALESCE((SELECT rate FROM settings), 20.00) ELSE 0.00 END,
  "taxBaseAtSale" = CASE
    WHEN COALESCE((SELECT registered FROM settings), false)
      THEN ROUND((o."total" / (1 + COALESCE((SELECT rate FROM settings), 20.00) / 100.0))::numeric, 2)
    ELSE o."total"
  END,
  "vatAmountAtSale" = CASE
    WHEN COALESCE((SELECT registered FROM settings), false)
      THEN o."total" - ROUND((o."total" / (1 + COALESCE((SELECT rate FROM settings), 20.00) / 100.0))::numeric, 2)
    ELSE 0.00
  END;
