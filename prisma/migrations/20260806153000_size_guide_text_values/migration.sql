ALTER TABLE "SizeGuideValue" ADD COLUMN "valueText" TEXT;
UPDATE "SizeGuideValue"
SET "valueText" = CASE
  WHEN "value" IS NULL THEN NULL
  ELSE rtrim(rtrim("value"::text, '0'), '.')
END;
