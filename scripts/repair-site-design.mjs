import pg from "pg";
const { Client } = pg;

async function main() {
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS "SiteDesignSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "brandName" TEXT NOT NULL DEFAULT 'Online Store', "tagline" TEXT NOT NULL DEFAULT 'Онлайн магазин',
  "logoUrl" TEXT NOT NULL DEFAULT '', "darkLogoUrl" TEXT NOT NULL DEFAULT '', "faviconUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#5c0b2d', "secondaryColor" TEXT NOT NULL DEFAULT '#cda64d',
  "lightBackground" TEXT NOT NULL DEFAULT '#fbf7f2', "lightSurface" TEXT NOT NULL DEFAULT '#fffdf9', "lightText" TEXT NOT NULL DEFAULT '#21161b',
  "darkBackground" TEXT NOT NULL DEFAULT '#0d1119', "darkSurface" TEXT NOT NULL DEFAULT '#151c27', "darkText" TEXT NOT NULL DEFAULT '#f6f0f2',
  "borderRadius" INTEGER NOT NULL DEFAULT 18, "fontFamily" TEXT NOT NULL DEFAULT 'Arial, Helvetica, sans-serif',
  "headingFontFamily" TEXT NOT NULL DEFAULT 'Georgia, serif', "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteDesignSettings_pkey" PRIMARY KEY ("id")
)`);
// Repair legacy timestamp columns before any INSERT/UPSERT. Some older databases
// contain the columns without defaults and may already have NULL values.
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3)`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3)`);
await client.query(`UPDATE "SiteDesignSettings" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`);
await client.query(`UPDATE "SiteDesignSettings" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`);
await client.query(`ALTER TABLE "SiteDesignSettings" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
await client.query(`ALTER TABLE "SiteDesignSettings" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`);
await client.query(`ALTER TABLE "SiteDesignSettings" ALTER COLUMN "createdAt" SET NOT NULL`);
await client.query(`ALTER TABLE "SiteDesignSettings" ALTER COLUMN "updatedAt" SET NOT NULL`);

await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroVariant" TEXT NOT NULL DEFAULT 'classic'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "categoriesVariant" TEXT NOT NULL DEFAULT 'overlay'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "productsVariant" TEXT NOT NULL DEFAULT 'grid'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "showHero" BOOLEAN NOT NULL DEFAULT true`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "showBenefits" BOOLEAN NOT NULL DEFAULT true`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "showCategories" BOOLEAN NOT NULL DEFAULT true`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "showProducts" BOOLEAN NOT NULL DEFAULT true`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "homepageSectionOrder" TEXT NOT NULL DEFAULT 'hero,benefits,categories,products'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "customSectionsJson" TEXT NOT NULL DEFAULT '[]'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "pageContentJson" TEXT NOT NULL DEFAULT '{}'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "navigationItemsJson" TEXT NOT NULL DEFAULT '[{"href":"/","label":"Начало","visible":true},{"href":"/women","label":"Дамско","visible":true},{"href":"/men","label":"Мъжко","visible":true},{"href":"/kids","label":"Детско","visible":true},{"href":"/new","label":"Нови","visible":true},{"href":"/sale","label":"Промоции","visible":true},{"href":"/contact","label":"Контакти","visible":true},{"href":"/about","label":"За нас","visible":true}]'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroEyebrow" TEXT NOT NULL DEFAULT 'НОВА КОЛЕКЦИЯ'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroTitle" TEXT NOT NULL DEFAULT 'Елегантност, която подчертава теб'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroDescription" TEXT NOT NULL DEFAULT 'Подбрани модели с внимание към детайла и качество, на което можеш да разчиташ.'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroButtonText" TEXT NOT NULL DEFAULT 'Разгледай колекцията'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroButtonHref" TEXT NOT NULL DEFAULT '/new'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=2200&q=92'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsTitle1" TEXT NOT NULL DEFAULT 'Безплатна доставка'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsText1" TEXT NOT NULL DEFAULT 'Над 120 €'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsTitle2" TEXT NOT NULL DEFAULT '14 дни право на връщане'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsText2" TEXT NOT NULL DEFAULT 'Лесно и бързо'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsTitle3" TEXT NOT NULL DEFAULT 'Сигурно плащане'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsText3" TEXT NOT NULL DEFAULT '100% защита'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsTitle4" TEXT NOT NULL DEFAULT 'Качествени материали'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "benefitsText4" TEXT NOT NULL DEFAULT 'Гарантирано качество'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "categoriesTitle" TEXT NOT NULL DEFAULT 'Пазарувай по категории'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "womenTitle" TEXT NOT NULL DEFAULT 'Дамско'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "womenDescription" TEXT NOT NULL DEFAULT 'Открий стил и елегантност'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "womenImageUrl" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=1000&q=90'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "menTitle" TEXT NOT NULL DEFAULT 'Мъжко'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "menDescription" TEXT NOT NULL DEFAULT 'Класика и модерна визия за всеки ден'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "menImageUrl" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1000&q=90'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "kidsTitle" TEXT NOT NULL DEFAULT 'Детско'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "kidsDescription" TEXT NOT NULL DEFAULT 'Комфорт и качество за вашите деца'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "kidsImageUrl" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=1000&q=90'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "categoryButtonText" TEXT NOT NULL DEFAULT 'Разгледай'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "productsTitle" TEXT NOT NULL DEFAULT 'Нови продукти'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "productsLinkText" TEXT NOT NULL DEFAULT 'Виж всички'`);

await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerEyebrow" TEXT NOT NULL DEFAULT 'КЛУБ'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerTitle" TEXT NOT NULL DEFAULT 'Първи научавай за новите предложения'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerDescription" TEXT NOT NULL DEFAULT 'Абонирай се за новини, промоции и специални предложения.'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerAbout" TEXT NOT NULL DEFAULT 'Качествени продукти, сигурно пазаруване и обслужване с внимание.'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerShopTitle" TEXT NOT NULL DEFAULT 'Пазарувай'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerHelpTitle" TEXT NOT NULL DEFAULT 'Помощ'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerSocialTitle" TEXT NOT NULL DEFAULT 'Последвай ни'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "footerCopyright" TEXT NOT NULL DEFAULT '© 2026 Всички права запазени'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT NOT NULL DEFAULT ''`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT NOT NULL DEFAULT ''`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "tiktokUrl" TEXT NOT NULL DEFAULT ''`);
await client.query(`INSERT INTO "SiteDesignSettings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`);
console.log("SiteDesignSettings is ready.");
await client.query(`CREATE TABLE IF NOT EXISTS "DesignTheme" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "draftSnapshot" JSONB NOT NULL,
  "publishedSnapshot" JSONB,
  "publishedAt" TIMESTAMP(3),
  "createdById" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignTheme_pkey" PRIMARY KEY ("id")
)`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "DesignTheme_slug_key" ON "DesignTheme"("slug")`);
await client.query(`CREATE INDEX IF NOT EXISTS "DesignTheme_isActive_status_idx" ON "DesignTheme"("isActive", "status")`);
await client.query(`CREATE INDEX IF NOT EXISTS "DesignTheme_updatedAt_idx" ON "DesignTheme"("updatedAt")`);
await client.query(`CREATE TABLE IF NOT EXISTS "DesignThemeVersion" (
  "id" SERIAL NOT NULL,
  "themeId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "snapshot" JSONB NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignThemeVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesignThemeVersion_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "DesignTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "DesignThemeVersion_themeId_version_key" ON "DesignThemeVersion"("themeId", "version")`);
await client.query(`CREATE INDEX IF NOT EXISTS "DesignThemeVersion_themeId_createdAt_idx" ON "DesignThemeVersion"("themeId", "createdAt")`);
await client.query(`INSERT INTO "DesignTheme" ("name", "slug", "description", "status", "isActive", "draftSnapshot", "publishedSnapshot", "publishedAt", "updatedAt")
SELECT 'Основна тема', 'default', 'Главна тема на магазина', 'PUBLISHED', true, to_jsonb(s), to_jsonb(s), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SiteDesignSettings" s WHERE s."id" = 1
ON CONFLICT ("slug") DO NOTHING`);
await client.query(`INSERT INTO "DesignThemeVersion" ("themeId", "version", "label", "snapshot")
SELECT t."id", 1, 'Начална версия', t."publishedSnapshot" FROM "DesignTheme" t
WHERE t."slug" = 'default' AND NOT EXISTS (SELECT 1 FROM "DesignThemeVersion" v WHERE v."themeId" = t."id")`);
console.log("Design Studio Enterprise tables are ready.");


await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT NOT NULL DEFAULT 'Online Store | Онлайн магазин'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT NOT NULL DEFAULT 'Премиум онлайн селекция от дамска, мъжка и детска мода, обувки и аксесоари.'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT NOT NULL DEFAULT 'мода, дамски дрехи, мъжки дрехи, детски дрехи, онлайн магазин'`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoCanonicalUrl" TEXT NOT NULL DEFAULT ''`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoOgImageUrl" TEXT NOT NULL DEFAULT ''`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoIndex" BOOLEAN NOT NULL DEFAULT true`);
await client.query(`ALTER TABLE "SiteDesignSettings" ADD COLUMN IF NOT EXISTS "seoFollow" BOOLEAN NOT NULL DEFAULT true`);

// Catalog sections are the page-level shop areas. Categories are filters inside a section.
await client.query(`CREATE TABLE IF NOT EXISTS "CatalogSection" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "eyebrow" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "baseAudience" "Audience" NOT NULL DEFAULT 'WOMEN',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogSection_pkey" PRIMARY KEY ("id")
)`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "CatalogSection_slug_key" ON "CatalogSection"("slug")`);
await client.query(`CREATE INDEX IF NOT EXISTS "CatalogSection_isActive_sortOrder_idx" ON "CatalogSection"("isActive", "sortOrder")`);
await client.query(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER`);
await client.query(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER`);
await client.query(`DO $$ BEGIN ALTER TABLE "Category" ADD CONSTRAINT "Category_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
await client.query(`DO $$ BEGIN ALTER TABLE "Product" ADD CONSTRAINT "Product_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
await client.query(`CREATE INDEX IF NOT EXISTS "Category_sectionId_idx" ON "Category"("sectionId")`);
await client.query(`CREATE INDEX IF NOT EXISTS "Product_sectionId_idx" ON "Product"("sectionId")`);
await client.query(`INSERT INTO "CatalogSection" ("name", "slug", "eyebrow", "description", "baseAudience", "isSystem", "sortOrder") VALUES
('Дамско', 'women', 'ДАМСКА МОДА', 'Елегантни и ежедневни модели.', 'WOMEN', true, 10),
('Мъжко', 'men', 'МЪЖКА МОДА', 'Изчистени и удобни мъжки модели.', 'MEN', true, 20),
('Детско', 'kids', 'ДЕТСКА МОДА', 'Практични предложения за деца.', 'KIDS', true, 30)
ON CONFLICT ("slug") DO NOTHING`);
await client.query(`UPDATE "Product" p SET "sectionId" = s."id" FROM "CatalogSection" s WHERE p."sectionId" IS NULL AND ((s."slug"='women' AND p."audience"='WOMEN') OR (s."slug"='men' AND p."audience"='MEN') OR (s."slug"='kids' AND p."audience"='KIDS'))`);
console.log("Catalog sections are ready.");
await client.end();
}

main().catch((error) => {
  const code = error?.code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    console.warn(`[repair-site-design] Database is not reachable (${code}). Skipping optional database repair. Run npm run db:repair-site-design after DATABASE_URL is correct.`);
    process.exit(0);
  }
  throw error;
});
