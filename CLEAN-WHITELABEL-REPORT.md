# Clean White-Label Report

Дата на проверката: 2026-08-11

## Removed files

- Премахнати са 316 исторически Markdown бележки от project root: release, RC, fix, hotfix, audit, QA и временни implementation отчети.
- Премахнати са 14 superseded документа от `docs/`. Оставени са само `SETUP.md`, `DEPLOYMENT.md` и `ENVIRONMENT.md`.
- Премахнати са три стари release ZIP архива, два локални `.cmd` launcher файла и временни lint/build артефакти.
- Премахнати са `.env` и `.env.local`. В шаблона остава само `.env.example` с placeholder стойности.
- Премахнати са еднократните скриптове `audit-i18n.mjs`, `cleanup-stale-release-files.mjs`, `convert-site-to-euro.mjs`, `init-auth-cart.mjs`, `init-db.mjs`, `make-admin.mjs`, `repair-dynamic-taxonomy.sql`, `repair-legacy-order-enums.sql` и `repair-page-builder.mjs`, след проверка на package scripts и runtime references.
- Премахнати са `lib/design-owner.ts` и `lib/protected-admins.ts`, които съдържаха специален достъп, обвързан с конкретни имейли.
- Премахнати са старите logo, root favicon, social/OG, upload и theme bootstrap assets, както и неизползваните default Next.js SVG файлове.
- След верификацията са премахнати `.next`, `node_modules`, `next-env.d.ts` и `tsconfig.tsbuildinfo`; те се генерират от стандартните install/build команди и са покрити от `.gitignore`.

## Branding cleanup

- Customer-facing името, tagline, logo, metadata, SEO, email/PDF headers, accounting labels и admin labels вече използват `SiteDesignSettings`, `LegalSettings`, ENV или generic fallback.
- Централният fallback е `Online Store`, дефиниран в `lib/brand.ts`; той не замества конфигурацията на клиента.
- Canonical URL, sitemap, robots, auth links, password reset, payment redirects и product metadata използват общия resolver в `lib/site-url.ts`.
- About, contact, terms и cookie страниците вече използват конфигурирани brand/legal стойности и не съдържат история, биографии или фирмени твърдения от предишния магазин.
- Admin help, demo shipment labels, design transfer files, Cloudinary folders, CSV/PDF exports и transactional email branding са generalized.
- Финалният case-insensitive scan отчита нула customer-facing brand, personal-email и production-domain съвпадения.

## Personal data cleanup

- Премахнати са лични имейли, имена, стари production контакти и project-specific домейни от source, tests, docs и assets.
- Премахнати са hardcoded protected-admin и design-owner проверки. Административният достъп вече следва database role и permission системата.
- Първият `SUPER_ADMIN` се задава еднократно чрез `BOOTSTRAP_SUPER_ADMIN_EMAILS`; няма вграден privileged account.
- Secret-bearing env файловете са премахнати без копиране на стойностите им в отчет, документация или example конфигурация.
- Seed данните са generic catalog данни и не създават клиенти, фирми или администратори.

## Configuration changes

- `SiteDesignSettings`: store name, tagline, primary/dark logo, favicon, colors, navigation, page content, theme snapshots и SEO. Visual Editor вече показва URL полета и за dark logo и favicon.
- `LegalSettings`: company name/ID, VAT, representative, addresses, website, phone, office contact, complaints contact и returns address.
- Social links: database-backed Admin > Social Networks.
- `NEXT_PUBLIC_SITE_URL`: публичен/canonical domain; старите URL env имена са само compatibility fallback.
- `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_ORDERS`, `EMAIL_SUPPORT` и `EMAIL_BRAND_NAME`: централизирана email конфигурация.
- `CLOUDINARY_FOLDER_PREFIX`: namespace за uploads.
- `.env.example`: безопасни placeholders за database, auth, Cloudinary, Resend, OAuth, legal data, bootstrap, couriers и payment provider.
- `npm run db:schema:check` валидира Prisma schema без да изисква secret-bearing локален env файл; временният URL е синтетичен и не се използва за връзка.

## Assets

- Премахнати са всички установени brand logos, favicon/Apple icon, OG image, branded upload image и legacy public theme scripts.
- Добавени са неутрални programmatic favicon и Apple icon с generic store-bag symbol.
- При празен `logoUrl` header/footer показват конфигурираното име като text fallback.
- При празен `faviconUrl` се използва неутралната template икона; при конфигурирана стойност metadata използва клиентската икона.
- Courier и Google OAuth logos са оставени, защото са активни third-party integration assets.
- Generic Unsplash catalog/hero изображенията са оставени като функционални development defaults.

## Technical identifiers retained

- Legacy browser namespace-ът е запазен само във вътрешни cookie names, session cookie, localStorage keys, BroadcastChannel names, DOM IDs, tracking de-duplication keys и CustomEvent/postMessage message types.
- Всеки retained identifier има активен producer и consumer. Преименуването би прекъснало съществуващи sessions, consent state, theme state, cart/favorites notifications, support badges, marketing events или Visual Editor preview communication.
- Тези identifiers не се визуализират пред клиент и не съдържат лични данни, email адрес или production URL.
- Negative regression tests запазват search patterns за предишната identity единствено като guard срещу повторното й появяване в customer-facing output.
- Историческите Prisma migrations не са редактирани; scan-ът не откри brand/personal-data причина за checksum-risk промяна.

## Tests

- `npm ci`: успешно; 407 packages installed, 0 npm vulnerabilities.
- Prisma Client generation: успешно при install и production build.
- `npm run qa`: успешно.
- Tests: 94 passed, 0 failed.
- ESLint: успешно, без errors/warnings.
- TypeScript `tsc --noEmit`: успешно.
- Prisma schema validation: успешно.
- Migration layout: 28 migrations verified.
- `npm run predeploy:check`: static release structure OK.
- `npm run build`: Next.js production build успешно; TypeScript, route collection и 65 static pages са генерирани успешно.
- Final reference, email, URL, filename и secret scans: няма customer-facing previous identity, personal data, production domain или реални credentials.

## Remaining warnings

- Migration checker предупреждава, че `support_ticket_center_v2` е подредена преди `support_tickets`. Вече мигрирани production бази не са засегнати; чисто нова база трябва да използва прегледан baseline, вместо историческата верига да се replay-ва без проверка.
- Workspace копието не съдържа `.git` metadata. Поради това `git status`, `git diff --stat` и `git diff` не могат да бъдат изпълнени; проверката е направена чрез пълен filesystem/source scan.
- Live database, Resend, OAuth, courier и payment checks не са изпълнявани с реални credentials. Template QA, demo integration tests и production compilation са успешни.
- Премахнатите env файлове съдържаха конфигурирани стойности. Всички credentials от предишното разпространявано копие трябва да бъдат rotated от съответните service owners.
