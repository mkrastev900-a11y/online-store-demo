-- Full relational-integrity hardening pass.
-- Goal: protect cross-table invariants even when a future API path writes directly.

-- 1) ProductVariant SKU is an identifier. Repair legacy duplicate non-null SKUs deterministically,
-- then make the identifier unique.
WITH ranked AS (
  SELECT "id", "sku", ROW_NUMBER() OVER (PARTITION BY "sku" ORDER BY "id") AS rn
  FROM "ProductVariant"
  WHERE "sku" IS NOT NULL
)
UPDATE "ProductVariant" pv
SET "sku" = pv."sku" || '-V' || pv."id"::text
FROM ranked r
WHERE pv."id" = r."id" AND r.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- 2) Product.stock is a denormalized cache of active ProductVariant.stock.
-- Keep it correct regardless of which code path changes a variant.
CREATE OR REPLACE FUNCTION "sync_product_stock_from_variants"()
RETURNS trigger AS $$
DECLARE
  target_product_id integer;
BEGIN
  target_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."productId" ELSE NEW."productId" END;

  UPDATE "Product" p
  SET "stock" = COALESCE((
    SELECT SUM(pv."stock")::integer
    FROM "ProductVariant" pv
    WHERE pv."productId" = target_product_id AND pv."isActive" = true
  ), 0),
  "updatedAt" = CURRENT_TIMESTAMP
  WHERE p."id" = target_product_id;

  IF TG_OP = 'UPDATE' AND OLD."productId" IS DISTINCT FROM NEW."productId" THEN
    UPDATE "Product" p
    SET "stock" = COALESCE((
      SELECT SUM(pv."stock")::integer
      FROM "ProductVariant" pv
      WHERE pv."productId" = OLD."productId" AND pv."isActive" = true
    ), 0),
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE p."id" = OLD."productId";
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductVariant_sync_product_stock" ON "ProductVariant";
CREATE TRIGGER "ProductVariant_sync_product_stock"
AFTER INSERT OR DELETE OR UPDATE OF "stock", "isActive", "productId" ON "ProductVariant"
FOR EACH ROW EXECUTE FUNCTION "sync_product_stock_from_variants"();

-- Defensive one-time resync.
UPDATE "Product" p
SET "stock" = COALESCE(v."stock", 0), "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT p2."id" AS "productId", COALESCE(SUM(CASE WHEN pv."isActive" THEN pv."stock" ELSE 0 END), 0)::integer AS "stock"
  FROM "Product" p2
  LEFT JOIN "ProductVariant" pv ON pv."productId" = p2."id"
  GROUP BY p2."id"
) v
WHERE p."id" = v."productId" AND p."stock" IS DISTINCT FROM v."stock";

-- 3) A SizeGuideValue may only connect a size and a measurement from the SAME guide.
CREATE OR REPLACE FUNCTION "check_size_guide_value_pair"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "SizeGuideSize" s
    JOIN "SizeGuideMeasurement" m ON m."sizeGuideId" = s."sizeGuideId"
    WHERE s."id" = NEW."sizeId" AND m."id" = NEW."measurementId"
  ) THEN
    RAISE EXCEPTION 'size % and measurement % belong to different size guides', NEW."sizeId", NEW."measurementId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SizeGuideValue_same_guide_guard" ON "SizeGuideValue";
CREATE TRIGGER "SizeGuideValue_same_guide_guard"
BEFORE INSERT OR UPDATE OF "sizeId", "measurementId" ON "SizeGuideValue"
FOR EACH ROW EXECUTE FUNCTION "check_size_guide_value_pair"();

-- 4) Support ticket order ownership and guest/account identity must stay coherent.
CREATE OR REPLACE FUNCTION "check_support_ticket_links"()
RETURNS trigger AS $$
BEGIN
  IF NEW."orderId" IS NOT NULL THEN
    IF NEW."userId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "Order" o WHERE o."id" = NEW."orderId" AND o."userId" = NEW."userId"
    ) THEN
      RAISE EXCEPTION 'support ticket order does not belong to ticket user'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."userId" IS NULL THEN
    IF NEW."guestEmail" IS NULL OR btrim(NEW."guestEmail") = '' OR NEW."guestName" IS NULL OR btrim(NEW."guestName") = '' THEN
      RAISE EXCEPTION 'guest support ticket requires guestName and guestEmail'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportTicket_link_guard" ON "SupportTicket";
CREATE TRIGGER "SupportTicket_link_guard"
BEFORE INSERT OR UPDATE OF "userId", "orderId", "guestName", "guestEmail" ON "SupportTicket"
FOR EACH ROW EXECUTE FUNCTION "check_support_ticket_links"();

-- 5) Ticket message authorship must match the ticket identity.
CREATE OR REPLACE FUNCTION "check_support_message_author"()
RETURNS trigger AS $$
DECLARE
  ticket_user_id integer;
BEGIN
  SELECT "userId" INTO ticket_user_id FROM "SupportTicket" WHERE "id" = NEW."ticketId";

  IF NEW."isAdmin" = false THEN
    IF ticket_user_id IS NULL THEN
      IF NEW."authorId" IS NOT NULL THEN
        RAISE EXCEPTION 'guest ticket customer message must not have an account author'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW."authorId" IS DISTINCT FROM ticket_user_id THEN
      RAISE EXCEPTION 'customer message author does not match ticket user'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW."authorId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "User" u
      WHERE u."id" = NEW."authorId" AND u."isActive" = true AND u."role" IN ('ADMIN', 'SUPER_ADMIN')
    ) THEN
      RAISE EXCEPTION 'admin support message requires an active administrator author'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportTicketMessage_author_guard" ON "SupportTicketMessage";
CREATE TRIGGER "SupportTicketMessage_author_guard"
BEFORE INSERT OR UPDATE OF "ticketId", "authorId", "isAdmin" ON "SupportTicketMessage"
FOR EACH ROW EXECUTE FUNCTION "check_support_message_author"();

-- 6) An assigned support employee must currently be an active administrator.
CREATE OR REPLACE FUNCTION "check_support_assignee"()
RETURNS trigger AS $$
BEGIN
  IF NEW."assignedAdminId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "User" u
    WHERE u."id" = NEW."assignedAdminId" AND u."isActive" = true AND u."role" IN ('ADMIN', 'SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'support assignee must be an active administrator'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportTicket_assignee_guard" ON "SupportTicket";
CREATE TRIGGER "SupportTicket_assignee_guard"
BEFORE INSERT OR UPDATE OF "assignedAdminId" ON "SupportTicket"
FOR EACH ROW EXECUTE FUNCTION "check_support_assignee"();

-- 7) An order reservation quantity may not exceed the ordered quantity of that variant.
CREATE OR REPLACE FUNCTION "check_order_reservation_quantity"()
RETURNS trigger AS $$
DECLARE
  ordered_quantity integer;
BEGIN
  SELECT COALESCE(SUM(oi."quantity"), 0)::integer INTO ordered_quantity
  FROM "OrderItem" oi
  WHERE oi."orderId" = NEW."orderId" AND oi."variantId" = NEW."variantId";

  IF ordered_quantity <= 0 OR NEW."quantity" > ordered_quantity THEN
    RAISE EXCEPTION 'order reservation quantity % exceeds ordered quantity %', NEW."quantity", ordered_quantity
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "OrderInventoryReservation_quantity_guard" ON "OrderInventoryReservation";
CREATE TRIGGER "OrderInventoryReservation_quantity_guard"
BEFORE INSERT OR UPDATE OF "orderId", "variantId", "quantity" ON "OrderInventoryReservation"
FOR EACH ROW EXECUTE FUNCTION "check_order_reservation_quantity"();

-- 8) Bring manually stored user-id fields into real FK protection.
UPDATE "SiteDesignSettings" s SET "updatedById" = NULL
WHERE s."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = s."updatedById");
UPDATE "DesignTheme" d SET "createdById" = NULL
WHERE d."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = d."createdById");
UPDATE "DesignTheme" d SET "updatedById" = NULL
WHERE d."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = d."updatedById");
UPDATE "DesignThemeVersion" d SET "createdById" = NULL
WHERE d."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = d."createdById");
UPDATE "CmsContentType" c SET "createdById" = NULL
WHERE c."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."createdById");
UPDATE "CmsContentType" c SET "updatedById" = NULL
WHERE c."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."updatedById");
UPDATE "CmsContentEntry" c SET "createdById" = NULL
WHERE c."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."createdById");
UPDATE "CmsContentEntry" c SET "updatedById" = NULL
WHERE c."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."updatedById");

DO $$ BEGIN ALTER TABLE "SiteDesignSettings" ADD CONSTRAINT "SiteDesignSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DesignTheme" ADD CONSTRAINT "DesignTheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DesignTheme" ADD CONSTRAINT "DesignTheme_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DesignThemeVersion" ADD CONSTRAINT "DesignThemeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CmsContentType" ADD CONSTRAINT "CmsContentType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CmsContentType" ADD CONSTRAINT "CmsContentType_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CmsContentEntry" ADD CONSTRAINT "CmsContentEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CmsContentEntry" ADD CONSTRAINT "CmsContentEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9) Exactly one active visual theme is allowed. Keep the most recently updated active theme.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "publishedAt" DESC NULLS LAST, "updatedAt" DESC, "id" DESC) rn
  FROM "DesignTheme" WHERE "isActive" = true
)
UPDATE "DesignTheme" d SET "isActive" = false
FROM ranked r WHERE d."id" = r."id" AND r.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "DesignTheme_single_active_key" ON "DesignTheme" ("isActive") WHERE "isActive" = true;

-- 10) New numeric data must be financially sane. NOT VALID protects new writes without
-- rewriting historical orders; the audit reports any old violations for explicit review.
DO $$ BEGIN ALTER TABLE "Product" ADD CONSTRAINT "Product_price_nonnegative_chk" CHECK ("price" >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Product" ADD CONSTRAINT "Product_compare_price_chk" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_averageCost_nonnegative_chk" CHECK ("averageCost" IS NULL OR "averageCost" >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_regular_percent_chk" CHECK ("regularDiscountPercent" >= 0 AND "regularDiscountPercent" <= 100) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_sale_percent_chk" CHECK ("saleDiscountPercent" >= 0 AND "saleDiscountPercent" <= 100) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Order" ADD CONSTRAINT "Order_total_nonnegative_chk" CHECK ("total" >= 0 AND "shippingCost" >= 0 AND "promoDiscount" >= 0 AND "taxBaseAtSale" >= 0 AND "vatAmountAtSale" >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Order" ADD CONSTRAINT "Order_vat_rate_chk" CHECK ("vatRateAtSale" >= 0 AND "vatRateAtSale" <= 100) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_money_nonnegative_chk" CHECK ("price" >= 0 AND ("unitCost" IS NULL OR "unitCost" >= 0) AND ("totalCost" IS NULL OR "totalCost" >= 0)) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SupportRmaRequest" ADD CONSTRAINT "SupportRmaRequest_refund_nonnegative_chk" CHECK ("refundAmount" IS NULL OR "refundAmount" >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "LegalSettings" ADD CONSTRAINT "LegalSettings_vat_rate_chk" CHECK ("defaultVatRate" >= 0 AND "defaultVatRate" <= 100) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11) Admin permissions cannot be granted to a non-admin account at write time.
CREATE OR REPLACE FUNCTION "check_admin_permission_user"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u."id" = NEW."userId" AND u."role" IN ('ADMIN', 'SUPER_ADMIN') AND u."isActive" = true
  ) THEN
    RAISE EXCEPTION 'admin permission target must be an active administrator'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "AdminPermission_user_guard" ON "AdminPermission";
CREATE TRIGGER "AdminPermission_user_guard"
BEFORE INSERT OR UPDATE OF "userId" ON "AdminPermission"
FOR EACH ROW EXECUTE FUNCTION "check_admin_permission_user"();

-- Index the newly modeled attachment -> message relation for joins and FK maintenance.
CREATE INDEX IF NOT EXISTS "SupportTicketAttachment_messageId_idx" ON "SupportTicketAttachment"("messageId");

-- 12) If an administrator is deactivated/demoted outside the application, remove live permissions
-- and support assignments automatically. Historical AuditLog/message authors remain untouched.
CREATE OR REPLACE FUNCTION "cleanup_admin_live_relations"()
RETURNS trigger AS $$
BEGIN
  IF NEW."isActive" = false OR NEW."role" NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    DELETE FROM "AdminPermission" WHERE "userId" = NEW."id";
    UPDATE "SupportTicket" SET "assignedAdminId" = NULL WHERE "assignedAdminId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "User_cleanup_admin_live_relations" ON "User";
CREATE TRIGGER "User_cleanup_admin_live_relations"
AFTER UPDATE OF "role", "isActive" ON "User"
FOR EACH ROW
WHEN (OLD."role" IS DISTINCT FROM NEW."role" OR OLD."isActive" IS DISTINCT FROM NEW."isActive")
EXECUTE FUNCTION "cleanup_admin_live_relations"();

-- 13) RMA restocking can never exceed the currently approved quantity.
DO $$ BEGIN
  ALTER TABLE "SupportRmaItem"
  ADD CONSTRAINT "SupportRmaItem_restocked_not_above_approved_chk"
  CHECK ("restockedQuantity" <= COALESCE("approvedQuantity", "quantity")) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Serialize and protect cumulative RMA quantities for a purchased line.
CREATE OR REPLACE FUNCTION "check_rma_cumulative_quantity"()
RETURNS trigger AS $$
DECLARE
  request_status "SupportRmaStatus";
  purchased integer;
  total_active integer;
BEGIN
  SELECT r."status" INTO request_status FROM "SupportRmaRequest" r WHERE r."id" = NEW."requestId";
  SELECT oi."quantity" INTO purchased FROM "OrderItem" oi WHERE oi."id" = NEW."orderItemId";
  PERFORM 1 FROM "OrderItem" oi WHERE oi."id" = NEW."orderItemId" FOR UPDATE;

  SELECT COALESCE(SUM(ri."quantity"),0)::integer INTO total_active
  FROM "SupportRmaItem" ri
  JOIN "SupportRmaRequest" rr ON rr."id" = ri."requestId"
  WHERE ri."orderItemId" = NEW."orderItemId"
    AND rr."status" <> 'REJECTED'
    AND (TG_OP = 'INSERT' OR ri."id" <> NEW."id");

  IF request_status <> 'REJECTED' THEN total_active := total_active + NEW."quantity"; END IF;
  IF purchased IS NULL OR total_active > purchased THEN
    RAISE EXCEPTION 'cumulative RMA quantity % exceeds purchased quantity %', total_active, COALESCE(purchased,0)
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "SupportRmaItem_cumulative_quantity_guard" ON "SupportRmaItem";
CREATE TRIGGER "SupportRmaItem_cumulative_quantity_guard"
BEFORE INSERT OR UPDATE OF "requestId", "orderItemId", "quantity" ON "SupportRmaItem"
FOR EACH ROW EXECUTE FUNCTION "check_rma_cumulative_quantity"();

-- A rejected RMA can later become active; validate cumulative quantities on that status transition too.
CREATE OR REPLACE FUNCTION "check_rma_request_activation"()
RETURNS trigger AS $$
DECLARE
  bad_count integer;
BEGIN
  IF OLD."status" = 'REJECTED' AND NEW."status" <> 'REJECTED' THEN
    PERFORM 1 FROM "Order" o WHERE o."id" = NEW."orderId" FOR UPDATE;
    SELECT COUNT(*)::integer INTO bad_count
    FROM (
      SELECT ri."orderItemId", SUM(ri."quantity") qty, oi."quantity" purchased
      FROM "SupportRmaItem" ri
      JOIN "SupportRmaRequest" rr ON rr."id" = ri."requestId"
      JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
      WHERE ri."orderItemId" IN (SELECT "orderItemId" FROM "SupportRmaItem" WHERE "requestId" = NEW."id")
        AND (rr."status" <> 'REJECTED' OR rr."id" = NEW."id")
      GROUP BY ri."orderItemId", oi."quantity"
      HAVING SUM(ri."quantity") > oi."quantity"
    ) x;
    IF bad_count > 0 THEN
      RAISE EXCEPTION 'reactivating RMA would exceed purchased quantity' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "SupportRmaRequest_activation_quantity_guard" ON "SupportRmaRequest";
CREATE TRIGGER "SupportRmaRequest_activation_quantity_guard"
BEFORE UPDATE OF "status" ON "SupportRmaRequest"
FOR EACH ROW EXECUTE FUNCTION "check_rma_request_activation"();

-- Refund finalization is serialized on the order row and cannot exceed either the order total
-- or the approved item value of this RMA.
CREATE OR REPLACE FUNCTION "check_rma_refund_limits"()
RETURNS trigger AS $$
DECLARE
  order_total numeric;
  previous_refunds numeric;
  item_limit numeric;
BEGIN
  IF NEW."status" = 'REFUNDED' AND NEW."approvedResolution" = 'REFUND' THEN
    IF NEW."refundAmount" IS NULL OR NEW."refundAmount" <= 0 THEN
      RAISE EXCEPTION 'refunded RMA requires a positive refundAmount' USING ERRCODE = '23514';
    END IF;

    SELECT o."total" INTO order_total FROM "Order" o WHERE o."id" = NEW."orderId" FOR UPDATE;
    SELECT COALESCE(SUM(rr."refundAmount"),0) INTO previous_refunds
    FROM "SupportRmaRequest" rr
    WHERE rr."orderId" = NEW."orderId" AND rr."id" <> NEW."id"
      AND rr."status" = 'REFUNDED' AND rr."approvedResolution" = 'REFUND';

    SELECT COALESCE(SUM(oi."price" * COALESCE(ri."approvedQuantity", ri."quantity")),0) INTO item_limit
    FROM "SupportRmaItem" ri JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
    WHERE ri."requestId" = NEW."id";

    IF previous_refunds + NEW."refundAmount" > order_total + 0.009 THEN
      RAISE EXCEPTION 'cumulative refunds exceed order total' USING ERRCODE = '23514';
    END IF;
    IF NEW."refundAmount" > item_limit + 0.009 THEN
      RAISE EXCEPTION 'refund exceeds approved RMA item value' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "SupportRmaRequest_refund_limit_guard" ON "SupportRmaRequest";
CREATE TRIGGER "SupportRmaRequest_refund_limit_guard"
BEFORE INSERT OR UPDATE OF "status", "approvedResolution", "refundAmount", "orderId" ON "SupportRmaRequest"
FOR EACH ROW EXECUTE FUNCTION "check_rma_refund_limits"();

-- 14) Canonicalize identity keys at the database boundary too. Application code already normalizes
-- these values, but triggers prevent direct/manual writes from creating case variants.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT lower(btrim("email")) AS normalized, COUNT(*)
      FROM "User"
      GROUP BY lower(btrim("email"))
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    UPDATE "User" SET "email" = lower(btrim("email")) WHERE "email" IS DISTINCT FROM lower(btrim("email"));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "normalize_user_email"()
RETURNS trigger AS $$
BEGIN
  NEW."email" := lower(btrim(NEW."email"));
  IF NEW."email" = '' THEN
    RAISE EXCEPTION 'user email cannot be empty' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "User_normalize_email" ON "User";
CREATE TRIGGER "User_normalize_email"
BEFORE INSERT OR UPDATE OF "email" ON "User"
FOR EACH ROW EXECUTE FUNCTION "normalize_user_email"();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT lower(btrim("email")) AS normalized, COUNT(*)
      FROM "User"
      GROUP BY lower(btrim("email"))
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key" ON "User" (lower("email"));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT upper(btrim("code")) AS normalized, COUNT(*)
      FROM "PromoCode"
      GROUP BY upper(btrim("code"))
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    UPDATE "PromoCode" SET "code" = upper(btrim("code")) WHERE "code" IS DISTINCT FROM upper(btrim("code"));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "normalize_promo_code"()
RETURNS trigger AS $$
BEGIN
  NEW."code" := upper(btrim(NEW."code"));
  IF NEW."code" = '' THEN
    RAISE EXCEPTION 'promo code cannot be empty' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "PromoCode_normalize_code" ON "PromoCode";
CREATE TRIGGER "PromoCode_normalize_code"
BEFORE INSERT OR UPDATE OF "code" ON "PromoCode"
FOR EACH ROW EXECUTE FUNCTION "normalize_promo_code"();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT upper(btrim("code")) AS normalized, COUNT(*)
      FROM "PromoCode"
      GROUP BY upper(btrim("code"))
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_upper_key" ON "PromoCode" (upper("code"));
  END IF;
END $$;
