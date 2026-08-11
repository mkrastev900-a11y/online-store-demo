import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL липсва. Провери .env.local или .env.");
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query(`ALTER TYPE "DeliveryMethod" ADD VALUE IF NOT EXISTS 'COURIER'`);
  await client.query(`ALTER TYPE "CheckoutPaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER'`);
  console.log("Legacy enum стойностите COURIER и BANK_TRANSFER са синхронизирани успешно.");
} finally {
  await client.end();
}
