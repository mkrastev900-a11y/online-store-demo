# V8 PUBLIC DEMO — NEON / VERCEL

## Цел

Публична white-label demo версия за бъдещи купувачи.

## Промени

- Prisma datasource: PostgreSQL.
- `DATABASE_URL` е предназначен за Neon pooled PostgreSQL connection string.
- Vercel build: `npm run vercel:build`.
- Vercel build създава/синхронизира схемата чрез `prisma db push --accept-data-loss`, seed-ва каталога и bootstrap-ва demo admin.
- Demo admin: username `admin`, display name `Админ`, role `SUPER_ADMIN`.
- След login admin се връща към `/`; header/session логиката показва реалния профил и admin navigation.
- Demo TTL: 30 минути.
- Добавен best-effort cleanup при normal server requests, за да работи self-cleaning demo и на Vercel Hobby.
- `/api/internal/demo-cleanup` остава защитен с `CRON_SECRET`.
- Добавен optional `vercel.pro-cron.json.example` за 5-минутен Vercel Pro cron.
- Премахнати локалните SQLite `.env`, `.db`, START/STOP/RESET scripts и SQLite migration notes от public archive.
- `.env.example` не съдържа реални credentials.

## Fresh Neon database

Този cleaned archive не разчита на `prisma migrate deploy` при първи bootstrap, защото historical migrations не съдържат оригиналната baseline migration. За новия изолиран demo Neon project се използва текущият Prisma schema чрез `db push`.

## Security

Публичният `admin/admin` е умишлен demo акаунт. Не използвай този deployment за реални клиенти, реални payment/courier production credentials или чувствителни фирмени данни.
