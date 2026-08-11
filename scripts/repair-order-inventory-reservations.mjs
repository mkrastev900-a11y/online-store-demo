import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("Липсва DATABASE_URL. Стартирай командата през npm скрипта от корена на проекта.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS public."OrderInventoryReservation" (
      "id" SERIAL NOT NULL,
      "orderId" INTEGER NOT NULL,
      "variantId" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "OrderInventoryReservation_pkey" PRIMARY KEY ("id")
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OrderInventoryReservation_orderId_variantId_key"
    ON public."OrderInventoryReservation"("orderId", "variantId")
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "OrderInventoryReservation_variantId_expiresAt_idx"
    ON public."OrderInventoryReservation"("variantId", "expiresAt")
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "OrderInventoryReservation_orderId_expiresAt_idx"
    ON public."OrderInventoryReservation"("orderId", "expiresAt")
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OrderInventoryReservation_orderId_fkey'
      ) THEN
        ALTER TABLE public."OrderInventoryReservation"
        ADD CONSTRAINT "OrderInventoryReservation_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES public."Order"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OrderInventoryReservation_variantId_fkey'
      ) THEN
        ALTER TABLE public."OrderInventoryReservation"
        ADD CONSTRAINT "OrderInventoryReservation_variantId_fkey"
        FOREIGN KEY ("variantId") REFERENCES public."ProductVariant"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  await client.query("COMMIT");
  console.log("Готово: таблицата OrderInventoryReservation и индексите ѝ са налични.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Поправката на OrderInventoryReservation не успя:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
