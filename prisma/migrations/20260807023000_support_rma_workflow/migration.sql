CREATE TYPE "SupportRmaStatus" AS ENUM ('REQUESTED','UNDER_REVIEW','APPROVED','PARTIALLY_APPROVED','REJECTED','AWAITING_RETURN','IN_TRANSIT','RECEIVED','REFUND_PENDING','REFUNDED','REPLACEMENT_SENT','CLOSED');
CREATE TYPE "SupportRmaResolution" AS ENUM ('REFUND','EXCHANGE','REPLACEMENT','REPAIR','STORE_CREDIT','OTHER');
CREATE TYPE "SupportRmaReason" AS ENUM ('WRONG_SIZE','DEFECTIVE','DAMAGED_IN_TRANSIT','WRONG_ITEM','NOT_AS_DESCRIBED','CHANGED_MIND','OTHER');

CREATE TABLE "SupportRmaRequest" (
  "id" SERIAL NOT NULL,
  "reference" VARCHAR(32) NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderId" INTEGER NOT NULL,
  "status" "SupportRmaStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedResolution" "SupportRmaResolution" NOT NULL,
  "approvedResolution" "SupportRmaResolution",
  "reason" "SupportRmaReason" NOT NULL,
  "customerNote" TEXT,
  "adminDecision" TEXT,
  "refundAmount" DECIMAL(14,2),
  "returnTrackingNumber" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupportRmaRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupportRmaItem" (
  "id" SERIAL NOT NULL,
  "requestId" INTEGER NOT NULL,
  "orderItemId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "approvedQuantity" INTEGER,
  "customerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportRmaItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportRmaRequest_reference_key" ON "SupportRmaRequest"("reference");
CREATE UNIQUE INDEX "SupportRmaRequest_ticketId_key" ON "SupportRmaRequest"("ticketId");
CREATE INDEX "SupportRmaRequest_status_createdAt_idx" ON "SupportRmaRequest"("status", "createdAt");
CREATE INDEX "SupportRmaRequest_userId_createdAt_idx" ON "SupportRmaRequest"("userId", "createdAt");
CREATE INDEX "SupportRmaRequest_orderId_idx" ON "SupportRmaRequest"("orderId");
CREATE UNIQUE INDEX "SupportRmaItem_requestId_orderItemId_key" ON "SupportRmaItem"("requestId", "orderItemId");
CREATE INDEX "SupportRmaItem_orderItemId_idx" ON "SupportRmaItem"("orderItemId");
ALTER TABLE "SupportRmaRequest" ADD CONSTRAINT "SupportRmaRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRmaRequest" ADD CONSTRAINT "SupportRmaRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRmaRequest" ADD CONSTRAINT "SupportRmaRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRmaItem" ADD CONSTRAINT "SupportRmaItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRmaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRmaItem" ADD CONSTRAINT "SupportRmaItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
