# Demo Mode Implementation Report

Дата на проверката: 2026-08-11

## Admin bootstrap

- Проектът няма `username` поле и продължава да използва уникалния `User.email` като database identity.
- При explicit activation login alias `admin` се преобразува до конфигурирания test-admin email, след което заявката преминава през съществуващите `findUserByEmail`, `bcrypt.compare`, email/terms checks, JWT session и role/permission проверки.
- Няма hardcoded authentication success branch или permission bypass.
- `scripts/bootstrap-test-admin.mjs` използва bcrypt cost 12, създава/актуализира реален `User` с `SUPER_ADMIN` role, verified email/terms state и cart.
- Bootstrap-ът е idempotent: unique email + `upsert` предотвратяват duplicates; повторното изпълнение проверява съществуващия hash и запазва един user/cart.
- Bootstrap-ът се извиква от `predev`, `prestart` и generic database seed. Когато `CREATE_TEST_ADMIN` не е точно `true`, той приключва без database query.
- Normal production defaults са `CREATE_TEST_ADMIN=false` и `DEMO_MODE=false`. Production readiness gate отказва test admin извън explicit demo deployment.

## Demo cleanup

- Централната server-side функция е `cleanupExpiredDemoData` в `lib/demo-data-cleanup.ts`; relation-aware transaction логиката е в `lib/demo-data-cleanup-core.ts`.
- TTL е positive integer от `DEMO_DATA_TTL_MINUTES`, с безопасен default 30. Cutoff условието е `createdAt < now - TTL`; `viewedAt` и `resetAt` се използват при моделите, които нямат `createdAt`.
- Cleanup-ът използва една Serializable Prisma transaction, безопасен child-to-parent ред и е idempotent.
- Изтриват се изтекли `CUSTOMER` users и свързаните с тях records, както и изтекли demo transaction records, включително:
  - `PasswordResetToken`, `EmailVerificationCode`, `CartItem`, customer `Cart`;
  - `Favorite`, `ProductView`, `InventoryReservation`, `OrderInventoryReservation`;
  - `SupportTicketAttachment`, `SupportTicketInternalNote`, `SupportTicketMessage`;
  - `SupportRmaItem`, `SupportRmaRequest`, `SupportTicket`;
  - `OrderItem`, `Order`;
  - `CustomerNote`, `CustomerTagAssignment`, transient `AdminNavAlertView`;
  - expired `RateLimitBucket` и old transactional `EmailDelivery` audit records.
- Session storage е stateless JWT cookie, не database model. След user deletion съществуващият cookie вече не минава active-user проверката.
- Преди order deletion потвърдени, изпратени и доставени demo orders възстановяват само количествата, които още не са restock-нати от RMA. Variant `stock`/`sold` и aggregate product stock се синхронизират в същата transaction.
- Cleanup-ът не изпраща email и не извиква payment, refund, ePay или courier APIs.
- Support attachment metadata се изтрива transactionally. След commit се използва съществуващият Cloudinary delete helper като best-effort remote cleanup.

## Preserved records

- Всички `ADMIN` и `SUPER_ADMIN` users, включително test administrator.
- `Product`, `ProductImage`, `ProductVariant` и inventory configuration.
- `CatalogSection`, `Category`, `ProductAttributeOption`, `PromoCode` definitions.
- `SizeGuide`, measurements, sizes и values.
- `SiteDesignSettings`, `DesignTheme`, `DesignThemeVersion` и navigation/page/theme snapshots.
- CMS content types, fields и entries.
- `LegalSettings`, `MarketingIntegrationSettings`, social configuration и integration structure.
- Prisma schema, migrations, indexes, relations и enums.
- System/configuration audit records; cleanup таргетира само transient user/email history.

## Scheduler

- Protected endpoint: `GET` или `POST /api/internal/demo-cleanup`.
- Endpoint-ът връща `403`, освен ако `DEMO_MODE=true`.
- Изисква exact `Authorization: Bearer <CRON_SECRET>`; липсващ или грешен secret връща `401`.
- `vercel.json` го планира на всеки 5 минути. Друг scheduler може да използва същия path/header.
- При всеки cycle се изтриват records, които вече са по-стари от TTL. Реалното премахване става при първия scheduler cycle след достигане на cutoff.
- Response/log summary съдържа само безопасни counts, без emails, passwords, tokens или credentials.

## Environment variables

- `DEMO_MODE`
- `DEMO_DATA_TTL_MINUTES`
- `CREATE_TEST_ADMIN`
- `TEST_ADMIN_USERNAME`
- `TEST_ADMIN_PASSWORD`
- `TEST_ADMIN_EMAIL`
- `CRON_SECRET`

## Tests

- `npm ci`: успешно; 407 packages installed, 0 npm vulnerabilities.
- Prisma Client generation: успешно.
- `npm run qa`: успешно.
- Automated tests: 103 passed, 0 failed, 0 skipped.
- ESLint: успешно, без errors/warnings.
- TypeScript `tsc --noEmit`: успешно.
- Prisma schema validation: успешно.
- Migration layout: 28 migrations verified.
- Existing checker warning remains: `support_ticket_center_v2` precedes `support_tickets`; migrated databases are unaffected, while a fresh database should use a reviewed baseline.
- `npm run predeploy:check`: успешно.
- `npm run build`: Next.js production build успешно; новият internal endpoint присъства в route graph и 65 static pages са генерирани.
- Runtime smoke при default safe configuration:
  - storefront, login, cart, checkout и contact: HTTP 200;
  - account, admin и Visual Editor: правилно redirect-ват към login без session;
  - cleanup endpoint: HTTP 403 при disabled demo mode;
  - demo notice: скрит при `DEMO_MODE=false`.
- Stateful Prisma-compatible transaction test покрива expired/fresh customer, admin, cart, favorite, order, RMA restock, support/attachment, stock restore, preserved catalog/settings, второ no-op cleanup и fresh records след cleanup.
- На локалната машина няма PostgreSQL service, Docker или `DATABASE_URL`. Поради това real-database admin login и endpoint deletion не са изпълнени; production кодът използва реалния Prisma client и transaction API, а DB поведението е валидирано чрез инжектирания Prisma-compatible test client.

## Safety

- Cleanup кодът не използва `DROP DATABASE`.
- Cleanup кодът не използва `DROP SCHEMA`.
- Cleanup кодът не използва `TRUNCATE CASCADE`.
- Cleanup кодът не използва `prisma migrate reset`.
- Cleanup кодът не използва forced database/schema reset.
- Няма schema relation промени и няма нова migration.
- Няма `setInterval`; scheduler-ът е външен и endpoint-driven.
- Remote attachment deletion е best-effort. При Cloudinary outage metadata вече е премахнато, затова е възможен orphaned remote file; cleanup transaction и следващите demo sessions остават работоспособни.
