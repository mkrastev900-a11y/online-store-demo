CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "regularDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "saleDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_isActive_createdAt_idx" ON "PromoCode"("isActive", "createdAt");

ALTER TABLE "Order" ADD COLUMN "promoCode" VARCHAR(60),
ADD COLUMN "promoDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "promoRegularPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "promoSalePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
