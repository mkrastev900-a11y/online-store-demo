import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failed = false;
const failures = [];

function report(name, count, details = "") {
  const status = count === 0 ? "OK" : "CONFLICT";
  console.log(`${status.padEnd(9)} ${name}: ${count}${details ? ` — ${details}` : ""}`);
  if (count > 0) {
    failed = true;
    failures.push({ name, count, details });
  }
}

async function count(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows?.[0]?.count ?? 0);
}

try {
  console.log("\n=== ONLINE STORE — FULL DATABASE INTEGRITY AUDIT ===\n");

  report("Product.stock differs from active variant stock", await count(`
    SELECT COUNT(*)::int AS count
    FROM "Product" p
    LEFT JOIN (
      SELECT "productId", COALESCE(SUM(CASE WHEN "isActive" THEN "stock" ELSE 0 END), 0)::int AS stock
      FROM "ProductVariant" GROUP BY "productId"
    ) v ON v."productId" = p."id"
    WHERE p."stock" <> COALESCE(v.stock, 0)
  `));

  report("Product section/category mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."sectionId" IS DISTINCT FROM c."sectionId"
  `));

  report("Products/categories with missing canonical section", await count(`
    SELECT COUNT(*)::int AS count
    FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."sectionId" IS NULL OR c."sectionId" IS NULL
  `), "a product must always have a real catalog section");

  report("Invalid inventory/quantity counters", await count(`
    SELECT (
      (SELECT COUNT(*) FROM "Product" WHERE "stock" < 0) +
      (SELECT COUNT(*) FROM "ProductVariant" WHERE "stock" < 0 OR "sold" < 0 OR "minStock" < 0) +
      (SELECT COUNT(*) FROM "CartItem" WHERE "quantity" <= 0) +
      (SELECT COUNT(*) FROM "InventoryReservation" WHERE "quantity" <= 0) +
      (SELECT COUNT(*) FROM "OrderInventoryReservation" WHERE "quantity" <= 0) +
      (SELECT COUNT(*) FROM "OrderItem" WHERE "quantity" <= 0)
    )::int AS count
  `));

  report("Invalid money/percentage values", await count(`
    SELECT (
      (SELECT COUNT(*) FROM "Product" WHERE "price" < 0 OR ("compareAtPrice" IS NOT NULL AND "compareAtPrice" < 0)) +
      (SELECT COUNT(*) FROM "ProductVariant" WHERE "averageCost" IS NOT NULL AND "averageCost" < 0) +
      (SELECT COUNT(*) FROM "PromoCode" WHERE "regularDiscountPercent" < 0 OR "regularDiscountPercent" > 100 OR "saleDiscountPercent" < 0 OR "saleDiscountPercent" > 100) +
      (SELECT COUNT(*) FROM "Order" WHERE "total" < 0 OR "shippingCost" < 0 OR "promoDiscount" < 0 OR "taxBaseAtSale" < 0 OR "vatAmountAtSale" < 0 OR "vatRateAtSale" < 0 OR "vatRateAtSale" > 100) +
      (SELECT COUNT(*) FROM "OrderItem" WHERE "price" < 0 OR ("unitCost" IS NOT NULL AND "unitCost" < 0) OR ("totalCost" IS NOT NULL AND "totalCost" < 0)) +
      (SELECT COUNT(*) FROM "SupportRmaRequest" WHERE "refundAmount" IS NOT NULL AND "refundAmount" < 0) +
      (SELECT COUNT(*) FROM "LegalSettings" WHERE "defaultVatRate" < 0 OR "defaultVatRate" > 100)
    )::int AS count
  `));


  report("Case-insensitive duplicate user emails", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT lower("email") FROM "User" GROUP BY lower("email") HAVING COUNT(*) > 1
    ) d
  `));

  report("Non-normalized user emails", await count(`
    SELECT COUNT(*)::int AS count FROM "User" WHERE "email" <> lower(btrim("email"))
  `), "login lookups assume lowercase email storage");

  report("Case-insensitive duplicate promo codes", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT upper(btrim("code")) FROM "PromoCode" GROUP BY upper(btrim("code")) HAVING COUNT(*) > 1
    ) x
  `));

  report("Non-normalized promo codes", await count(`
    SELECT COUNT(*)::int AS count FROM "PromoCode" WHERE "code" <> upper(btrim("code")) OR btrim("code") = ''
  `), "promo lookups assume uppercase canonical storage");

  report("Duplicate cart variant rows", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT "cartId", "variantId" FROM "CartItem" GROUP BY "cartId", "variantId" HAVING COUNT(*) > 1
    ) d
  `));

  report("Duplicate user reservation rows", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT "userId", "variantId" FROM "InventoryReservation" GROUP BY "userId", "variantId" HAVING COUNT(*) > 1
    ) d
  `));

  report("Duplicate non-null variant SKUs", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT "sku" FROM "ProductVariant" WHERE "sku" IS NOT NULL GROUP BY "sku" HAVING COUNT(*) > 1
    ) d
  `));

  report("Cart product/variant mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "CartItem" ci JOIN "ProductVariant" pv ON pv."id" = ci."variantId"
    WHERE pv."productId" <> ci."productId"
  `));

  report("Order product/variant mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "OrderItem" oi JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
    WHERE pv."productId" <> oi."productId"
  `), "historical rows must never be rewritten blindly");

  report("Size guide value crosses different guides", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SizeGuideValue" v
    JOIN "SizeGuideSize" s ON s."id" = v."sizeId"
    JOIN "SizeGuideMeasurement" m ON m."id" = v."measurementId"
    WHERE s."sizeGuideId" <> m."sizeGuideId"
  `));

  report("Order reservation/variant mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "OrderInventoryReservation" r
    WHERE NOT EXISTS (
      SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = r."orderId" AND oi."variantId" = r."variantId"
    )
  `));

  report("Order reservation quantity exceeds ordered quantity", await count(`
    SELECT COUNT(*)::int AS count
    FROM "OrderInventoryReservation" r
    WHERE r."quantity" > COALESCE((
      SELECT SUM(oi."quantity") FROM "OrderItem" oi
      WHERE oi."orderId" = r."orderId" AND oi."variantId" = r."variantId"
    ), 0)
  `));

  report("Active reservations exceed physical stock", await count(`
    WITH reserved AS (
      SELECT "variantId", SUM("quantity")::int qty FROM "InventoryReservation" WHERE "expiresAt" > NOW() GROUP BY "variantId"
      UNION ALL
      SELECT "variantId", SUM("quantity")::int qty FROM "OrderInventoryReservation" WHERE "expiresAt" > NOW() GROUP BY "variantId"
    ), totals AS (
      SELECT "variantId", SUM(qty)::int qty FROM reserved GROUP BY "variantId"
    )
    SELECT COUNT(*)::int AS count
    FROM totals t JOIN "ProductVariant" pv ON pv."id" = t."variantId"
    WHERE t.qty > pv."stock"
  `), "indicates overselling/reservation race");

  report("Support ticket order/user mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportTicket" st JOIN "Order" o ON o."id" = st."orderId"
    WHERE st."orderId" IS NOT NULL AND (st."userId" IS NULL OR o."userId" <> st."userId")
  `));

  report("Invalid guest support identity", await count(`
    SELECT COUNT(*)::int AS count FROM "SupportTicket"
    WHERE "userId" IS NULL AND ("guestName" IS NULL OR btrim("guestName") = '' OR "guestEmail" IS NULL OR btrim("guestEmail") = '')
  `));

  report("Support message author/ticket mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportTicketMessage" m
    JOIN "SupportTicket" t ON t."id" = m."ticketId"
    LEFT JOIN "User" u ON u."id" = m."authorId"
    WHERE
      (m."isAdmin" = false AND ((t."userId" IS NULL AND m."authorId" IS NOT NULL) OR (t."userId" IS NOT NULL AND m."authorId" IS DISTINCT FROM t."userId")))
      OR
      (m."isAdmin" = true AND (m."authorId" IS NULL OR u."id" IS NULL))
  `));

  report("Support assignee is not an active admin", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportTicket" t JOIN "User" u ON u."id" = t."assignedAdminId"
    WHERE t."assignedAdminId" IS NOT NULL AND (u."isActive" = false OR u."role" NOT IN ('ADMIN','SUPER_ADMIN'))
  `));

  report("Admin permissions attached to non-admin users", await count(`
    SELECT COUNT(*)::int AS count
    FROM "AdminPermission" p JOIN "User" u ON u."id" = p."userId"
    WHERE u."isActive" = false OR u."role" NOT IN ('ADMIN','SUPER_ADMIN')
  `));

  report("Support attachment/message mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportTicketAttachment" a
    LEFT JOIN "SupportTicketMessage" m ON m."id" = a."messageId"
    WHERE a."messageId" IS NOT NULL AND (m."id" IS NULL OR m."ticketId" <> a."ticketId")
  `));

  report("RMA item/order mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportRmaItem" ri
    JOIN "SupportRmaRequest" rr ON rr."id" = ri."requestId"
    JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
    WHERE oi."orderId" <> rr."orderId"
  `));

  report("RMA request/ticket/user/order mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "SupportRmaRequest" rr
    JOIN "SupportTicket" st ON st."id" = rr."ticketId"
    JOIN "Order" o ON o."id" = rr."orderId"
    WHERE rr."userId" <> o."userId" OR st."orderId" IS DISTINCT FROM rr."orderId" OR st."userId" IS DISTINCT FROM rr."userId"
  `));

  report("Invalid RMA quantities", await count(`
    SELECT COUNT(*)::int AS count FROM "SupportRmaItem"
    WHERE "quantity" <= 0 OR "restockedQuantity" < 0 OR "restockedQuantity" > "quantity"
       OR ("approvedQuantity" IS NOT NULL AND ("approvedQuantity" < 0 OR "approvedQuantity" > "quantity"))
       OR "restockedQuantity" > COALESCE("approvedQuantity", "quantity")
  `));

  report("Cumulative active RMA quantity exceeds purchased quantity", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT ri."orderItemId", SUM(ri."quantity") qty, oi."quantity" purchased
      FROM "SupportRmaItem" ri
      JOIN "SupportRmaRequest" rr ON rr."id" = ri."requestId" AND rr."status" <> 'REJECTED'
      JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
      GROUP BY ri."orderItemId", oi."quantity"
      HAVING SUM(ri."quantity") > oi."quantity"
    ) x
  `));

  report("Refunded amount exceeds order total", await count(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT rr."orderId", SUM(COALESCE(rr."refundAmount",0)) refunded, o."total"
      FROM "SupportRmaRequest" rr JOIN "Order" o ON o."id" = rr."orderId"
      WHERE rr."status" = 'REFUNDED' AND rr."approvedResolution" = 'REFUND'
      GROUP BY rr."orderId", o."total"
      HAVING SUM(COALESCE(rr."refundAmount",0)) > o."total" + 0.009
    ) x
  `));

  report("Order total arithmetic mismatch", await count(`
    SELECT COUNT(*)::int AS count
    FROM "Order" o
    LEFT JOIN (
      SELECT "orderId", COALESCE(SUM("price" * "quantity"),0) subtotal FROM "OrderItem" GROUP BY "orderId"
    ) i ON i."orderId" = o."id"
    WHERE ABS(o."total" - (COALESCE(i.subtotal,0) - o."promoDiscount" + o."shippingCost")) > 0.011
  `), "total must equal items - promo + shipping");

  report("VAT snapshot arithmetic mismatch", await count(`
    SELECT COUNT(*)::int AS count FROM "Order"
    WHERE
      ("vatRegisteredAtSale" = false AND ("vatRateAtSale" <> 0 OR "vatAmountAtSale" <> 0 OR ABS("taxBaseAtSale" - "total") > 0.011))
      OR
      ("vatRegisteredAtSale" = true AND ABS(("taxBaseAtSale" + "vatAmountAtSale") - "total") > 0.011)
  `));

  report("Order lifecycle timestamp mismatch", await count(`
    SELECT COUNT(*)::int AS count FROM "Order"
    WHERE
      ("status" IN ('CONFIRMED','SHIPPED','DELIVERED') AND "confirmedAt" IS NULL)
      OR ("status" IN ('SHIPPED','DELIVERED') AND "shippedAt" IS NULL)
      OR ("status" = 'DELIVERED' AND "deliveredAt" IS NULL)
      OR ("status" = 'CANCELLED' AND "cancelledAt" IS NULL)
  `));

  report("Paid payment status without paidAt", await count(`
    SELECT COUNT(*)::int AS count FROM "Order"
    WHERE "paymentStatus" IN ('PAID','PAID_REVIEW_REQUIRED') AND "paidAt" IS NULL
  `));

  report("Product primary image not present in image rows", await count(`
    SELECT COUNT(*)::int AS count FROM "Product" p
    WHERE NOT EXISTS (SELECT 1 FROM "ProductImage" i WHERE i."productId" = p."id" AND i."url" = p."imageUrl")
  `));

  report("Active product without an active variant", await count(`
    SELECT COUNT(*)::int AS count FROM "Product" p
    WHERE p."isActive" = true AND NOT EXISTS (
      SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id" AND v."isActive" = true
    )
  `));

  report("Invalid material composition", await count(`
    SELECT COUNT(*)::int AS count FROM "Product" p
    WHERE p."materialComposition" IS NOT NULL
      AND p."materialComposition" <> 'null'::jsonb
      AND (
        jsonb_typeof(p."materialComposition") <> 'array'
        OR CASE WHEN jsonb_typeof(p."materialComposition") = 'array' THEN jsonb_array_length(p."materialComposition") ELSE 0 END = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p."materialComposition") = 'array' THEN p."materialComposition" ELSE '[]'::jsonb END) e
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN COALESCE(e->>'percentage','') ~ '^[0-9]+([.][0-9]+)?$' THEN (e->>'percentage')::numeric
              ELSE NULL
            END AS pct
          ) parsed
          WHERE COALESCE(btrim(e->>'material'),'') = '' OR parsed.pct IS NULL OR parsed.pct <= 0
        )
        OR ABS((
          SELECT COALESCE(SUM(
            CASE WHEN COALESCE(e->>'percentage','') ~ '^[0-9]+([.][0-9]+)?$' THEN (e->>'percentage')::numeric ELSE 0 END
          ),0)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p."materialComposition") = 'array' THEN p."materialComposition" ELSE '[]'::jsonb END) e
        ) - 100) > 0.001
      )
  `), "material percentages must form exactly 100%");

  report("Multiple active design themes", await count(`
    SELECT CASE WHEN COUNT(*) > 1 THEN (COUNT(*) - 1)::int ELSE 0::int END AS count
    FROM "DesignTheme" WHERE "isActive" = true
  `));

  report("Orphan manual author/user references", await count(`
    SELECT (
      (SELECT COUNT(*) FROM "SiteDesignSettings" s WHERE s."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=s."updatedById")) +
      (SELECT COUNT(*) FROM "DesignTheme" d WHERE d."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=d."createdById")) +
      (SELECT COUNT(*) FROM "DesignTheme" d WHERE d."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=d."updatedById")) +
      (SELECT COUNT(*) FROM "DesignThemeVersion" d WHERE d."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=d."createdById")) +
      (SELECT COUNT(*) FROM "CmsContentType" c WHERE c."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=c."createdById")) +
      (SELECT COUNT(*) FROM "CmsContentType" c WHERE c."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=c."updatedById")) +
      (SELECT COUNT(*) FROM "CmsContentEntry" c WHERE c."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=c."createdById")) +
      (SELECT COUNT(*) FROM "CmsContentEntry" c WHERE c."updatedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"=c."updatedById"))
    )::int AS count
  `));


  report("Unvalidated foreign keys", await count(`
    SELECT COUNT(*)::int AS count FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'f' AND c.convalidated = false
  `));

  report("Missing expected relation foreign keys", await count(`
    WITH expected(name) AS (VALUES
      ('SupportTicketAttachment_messageId_fkey'),
      ('SiteDesignSettings_updatedById_fkey'),
      ('DesignTheme_createdById_fkey'),
      ('DesignTheme_updatedById_fkey'),
      ('DesignThemeVersion_createdById_fkey'),
      ('CmsContentType_createdById_fkey'),
      ('CmsContentType_updatedById_fkey'),
      ('CmsContentEntry_createdById_fkey'),
      ('CmsContentEntry_updatedById_fkey')
    )
    SELECT COUNT(*)::int AS count FROM expected e
    WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = e.name AND c.contype = 'f')
  `));

  report("Missing expected integrity triggers", await count(`
    WITH expected(name) AS (VALUES
      ('CartItem_product_variant_pair_guard'),
      ('OrderItem_product_variant_pair_guard'),
      ('Product_category_section_pair_guard'),
      ('Category_section_required_for_products_guard'),
      ('Category_section_sync_products'),
      ('SupportRmaItem_order_pair_guard'),
      ('SupportRmaRequest_link_guard'),
      ('OrderInventoryReservation_order_variant_guard'),
      ('SupportTicketAttachment_ticket_message_guard'),
      ('ProductVariant_sync_product_stock'),
      ('SizeGuideValue_same_guide_guard'),
      ('SupportTicket_link_guard'),
      ('SupportTicketMessage_author_guard'),
      ('SupportTicket_assignee_guard'),
      ('OrderInventoryReservation_quantity_guard'),
      ('AdminPermission_user_guard'),
      ('User_cleanup_admin_live_relations'),
      ('SupportRmaItem_cumulative_quantity_guard'),
      ('SupportRmaRequest_activation_quantity_guard'),
      ('SupportRmaRequest_refund_limit_guard'),
      ('User_normalize_email'),
      ('PromoCode_normalize_code')
    )
    SELECT COUNT(*)::int AS count FROM expected e
    WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname = e.name AND t.tgisinternal = false)
  `));

  report("Missing expected unique integrity indexes", await count(`
    WITH expected(name) AS (VALUES
      ('Category_sectionId_slug_key'),
      ('ProductVariant_sku_key'),
      ('DesignTheme_single_active_key'),
      ('User_email_lower_key'),
      ('PromoCode_code_upper_key')
    )
    SELECT COUNT(*)::int AS count FROM expected e
    WHERE NOT EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = e.name)
  `));

  report("Failed/unresolved Prisma migrations", await count(`
    SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
  `));

  report("Unexpected singleton settings rows", await count(`
    SELECT (
      (SELECT COUNT(*) FROM "LegalSettings" WHERE "id" <> 1) +
      (SELECT COUNT(*) FROM "SiteDesignSettings" WHERE "id" <> 1) +
      (SELECT COUNT(*) FROM "MarketingIntegrationSettings" WHERE "id" <> 1)
    )::int AS count
  `), "singleton configuration tables should only use id=1");

  report("Legacy ERP scalar references still populated", await count(`
    SELECT (
      (SELECT COUNT(*) FROM "InventoryReservation" WHERE "warehouseId" IS NOT NULL) +
      (SELECT COUNT(*) FROM "Order" WHERE "accountingEntryId" IS NOT NULL)
    )::int AS count
  `), "legacy ERP reference columns should remain empty until a dedicated cleanup migration removes them");

  const serialColumns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'
  `);
  let brokenSequences = 0;
  const qi = (value) => `"${String(value).replaceAll('"', '""')}"`;
  for (const row of serialColumns) {
    if (!row.sequence_name) continue;
    const table = qi(row.table_name);
    const column = qi(row.column_name);
    // sequence_name is returned by PostgreSQL itself via pg_get_serial_sequence.
    const sequenceSql = String(row.sequence_name);
    const result = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(MAX(${column}),0)::bigint AS max_id,
             (SELECT last_value::bigint FROM ${sequenceSql}) AS last_value
      FROM ${table}
    `);
    if (BigInt(result?.[0]?.last_value ?? 0) < BigInt(result?.[0]?.max_id ?? 0)) brokenSequences += 1;
  }
  report("Serial/identity sequences behind table MAX(id)", brokenSequences, "can cause duplicate primary-key inserts");

  console.log(failed ? `\nDatabase integrity audit FAILED with ${failures.length} conflict class(es).` : "\nDatabase integrity audit PASSED — all checked invariants are clean.");
  if (failed) {
    console.log("\nConflict classes:");
    for (const item of failures) console.log(`- ${item.name}: ${item.count}`);
  }
  process.exitCode = failed ? 2 : 0;
} finally {
  await prisma.$disconnect();
}
