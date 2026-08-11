-- Cross-table relation integrity guards found during the second database-link audit.
-- These triggers protect redundant foreign-key pairs that Prisma cannot express as a single relation.

CREATE OR REPLACE FUNCTION "check_product_variant_pair"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ProductVariant" pv
    WHERE pv."id" = NEW."variantId" AND pv."productId" = NEW."productId"
  ) THEN
    RAISE EXCEPTION 'variant % does not belong to product %', NEW."variantId", NEW."productId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CartItem_product_variant_pair_guard" ON "CartItem";
CREATE TRIGGER "CartItem_product_variant_pair_guard"
BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "CartItem"
FOR EACH ROW EXECUTE FUNCTION "check_product_variant_pair"();

DROP TRIGGER IF EXISTS "OrderItem_product_variant_pair_guard" ON "OrderItem";
CREATE TRIGGER "OrderItem_product_variant_pair_guard"
BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "check_product_variant_pair"();

CREATE OR REPLACE FUNCTION "check_product_category_section_pair"()
RETURNS trigger AS $$
BEGIN
  IF NEW."sectionId" IS NULL OR NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."id" = NEW."categoryId" AND c."sectionId" = NEW."sectionId"
  ) THEN
    RAISE EXCEPTION 'category % does not belong to product section %', NEW."categoryId", NEW."sectionId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Product_category_section_pair_guard" ON "Product";
CREATE TRIGGER "Product_category_section_pair_guard"
BEFORE INSERT OR UPDATE OF "categoryId", "sectionId" ON "Product"
FOR EACH ROW EXECUTE FUNCTION "check_product_category_section_pair"();

CREATE OR REPLACE FUNCTION "check_rma_order_item_pair"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "SupportRmaRequest" r
    JOIN "OrderItem" oi ON oi."id" = NEW."orderItemId"
    WHERE r."id" = NEW."requestId" AND oi."orderId" = r."orderId"
  ) THEN
    RAISE EXCEPTION 'order item % does not belong to RMA request order', NEW."orderItemId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportRmaItem_order_pair_guard" ON "SupportRmaItem";
CREATE TRIGGER "SupportRmaItem_order_pair_guard"
BEFORE INSERT OR UPDATE OF "requestId", "orderItemId" ON "SupportRmaItem"
FOR EACH ROW EXECUTE FUNCTION "check_rma_order_item_pair"();

CREATE OR REPLACE FUNCTION "check_order_reservation_variant"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "OrderItem" oi
    WHERE oi."orderId" = NEW."orderId" AND oi."variantId" = NEW."variantId"
  ) THEN
    RAISE EXCEPTION 'variant % is not part of order %', NEW."variantId", NEW."orderId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "OrderInventoryReservation_order_variant_guard" ON "OrderInventoryReservation";
CREATE TRIGGER "OrderInventoryReservation_order_variant_guard"
BEFORE INSERT OR UPDATE OF "orderId", "variantId" ON "OrderInventoryReservation"
FOR EACH ROW EXECUTE FUNCTION "check_order_reservation_variant"();

CREATE OR REPLACE FUNCTION "check_rma_request_links"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "SupportTicket" st
    JOIN "Order" o ON o."id" = NEW."orderId"
    WHERE st."id" = NEW."ticketId"
      AND st."orderId" = NEW."orderId"
      AND st."userId" = NEW."userId"
      AND o."userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'RMA ticket/user/order links are inconsistent'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportRmaRequest_link_guard" ON "SupportRmaRequest";
CREATE TRIGGER "SupportRmaRequest_link_guard"
BEFORE INSERT OR UPDATE OF "ticketId", "userId", "orderId" ON "SupportRmaRequest"
FOR EACH ROW EXECUTE FUNCTION "check_rma_request_links"();

-- Attachment.messageId is a logical relation in the application but historically had no FK.
-- Invalid legacy references are detached rather than deleting the attachment itself.
UPDATE "SupportTicketAttachment" a
SET "messageId" = NULL
WHERE a."messageId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SupportTicketMessage" m
    WHERE m."id" = a."messageId" AND m."ticketId" = a."ticketId"
  );

DO $$ BEGIN
  ALTER TABLE "SupportTicketAttachment"
    ADD CONSTRAINT "SupportTicketAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION "check_attachment_ticket_message_pair"()
RETURNS trigger AS $$
BEGIN
  IF NEW."messageId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "SupportTicketMessage" m
    WHERE m."id" = NEW."messageId" AND m."ticketId" = NEW."ticketId"
  ) THEN
    RAISE EXCEPTION 'message % does not belong to ticket %', NEW."messageId", NEW."ticketId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SupportTicketAttachment_ticket_message_guard" ON "SupportTicketAttachment";
CREATE TRIGGER "SupportTicketAttachment_ticket_message_guard"
BEFORE INSERT OR UPDATE OF "ticketId", "messageId" ON "SupportTicketAttachment"
FOR EACH ROW EXECUTE FUNCTION "check_attachment_ticket_message_pair"();
