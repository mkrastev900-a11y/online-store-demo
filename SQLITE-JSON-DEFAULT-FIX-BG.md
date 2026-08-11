# SQLite JSON default fix

Поправена е грешката `unrecognized token: "{"` при `prisma db push`.

Причина: Prisma SQLite schema push генерираше SQL от JSON полета с `@default("{}")`, което водеше до невалиден SQLite default literal.

Премахнати са database-level JSON defaults от:
- `MarketingIntegrationSettings.data`
- `CmsContentField.settings`
- `CmsContentEntry.data`
- `CmsContentEntry.seo`

Приложният код вече подава тези JSON стойности изрично при create/upsert, така че функционалността се запазва.

`START-DEMO.cmd` продължава да използва `prisma db push`, без PostgreSQL migrations.
