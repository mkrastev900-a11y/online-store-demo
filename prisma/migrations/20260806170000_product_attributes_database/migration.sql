ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productKind" VARCHAR(120);

CREATE TABLE IF NOT EXISTS "ProductAttributeOption" (
  "id" VARCHAR(120) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "family" "ProductType",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAttributeOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttributeOption_kind_label_key" ON "ProductAttributeOption"("kind", "label");
CREATE INDEX IF NOT EXISTS "ProductAttributeOption_kind_isActive_sortOrder_idx" ON "ProductAttributeOption"("kind", "isActive", "sortOrder");

INSERT INTO "ProductAttributeOption" ("id", "kind", "label", "family", "isActive", "sortOrder") VALUES
('t-shirt', 'productTypes', 'Тениска', 'CLOTHING', true, 10),
('dress', 'productTypes', 'Рокля', 'CLOTHING', true, 20),
('pants', 'productTypes', 'Панталон', 'CLOTHING', true, 30),
('sneakers', 'productTypes', 'Маратонки', 'SHOES', true, 40),
('ring', 'productTypes', 'Пръстен', 'ACCESSORY', true, 50),
('black', 'colors', 'Черен', NULL, true, 10),
('white', 'colors', 'Бял', NULL, true, 20),
('red', 'colors', 'Червен', NULL, true, 30),
('blue', 'colors', 'Син', NULL, true, 40),
('cotton', 'materials', 'Памук', NULL, true, 10),
('polyester', 'materials', 'Полиестер', NULL, true, 20),
('wool', 'materials', 'Вълна', NULL, true, 30),
('leather', 'materials', 'Кожа', NULL, true, 40)
ON CONFLICT ("id") DO NOTHING;
