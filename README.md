# Online Store

White-label ecommerce platform built with Next.js, React, Prisma, and PostgreSQL. It includes catalog and inventory management, customer accounts, cart and checkout, orders, ePay, Econt/Speedy integrations, support and RMA workflows, accounting reports, role-based administration, email delivery, and a visual editor.

## Requirements

- Node.js 20.9 or newer
- PostgreSQL
- Cloudinary for uploaded images
- Resend for transactional email
- Optional Google OAuth, Econt, Speedy, and ePay credentials

## Installation

```bash
npm ci
npx prisma generate
```

Create `.env.local` from `.env.example` and replace placeholders with credentials for the new installation. Never commit local or production env files.

## Environment

The complete variable reference is in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). At minimum, configure `DATABASE_URL`, `AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL`. Production email requires `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SUPPORT`, and `EMAIL_ORDERS`.

## Database

For a **fresh public demo Neon project**, this white-label archive intentionally creates the schema from the current Prisma model:

```bash
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed
```

The Vercel build command performs these steps automatically through `npm run vercel:build`. The historical migration directory is retained for project history/compatibility, but this cleaned demo archive does not contain the original baseline migration required to bootstrap an empty database with `prisma migrate deploy`; therefore do not use `migrate deploy` for the first fresh Neon database created from this archive.

## Development

```bash
npm run dev
```

## Production

```bash
npm run predeploy:check
npm run production:check
npm run qa
npm run build
npm start
```

Deployment details are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Initial Administration Setup

1. Register the future owner through the normal customer registration flow and verify the account.
2. Set `BOOTSTRAP_SUPER_ADMIN_EMAILS` to that registered email in the operator environment.
3. Run `npm run db:super-admins` once.
4. Remove `BOOTSTRAP_SUPER_ADMIN_EMAILS` and keep `BOOTSTRAP_ALLOW_UNVERIFIED=false`.

Further administrators and granular permissions are managed from Admin > Administrators. Access is based on database roles and permissions, never a hardcoded email allowlist.

## Demo Mode

Demo behavior is strictly opt-in. Configure an isolated, disposable environment with:

```env
DEMO_MODE=true
DEMO_DATA_TTL_MINUTES=30
CREATE_TEST_ADMIN=true
TEST_ADMIN_USERNAME=admin
TEST_ADMIN_PASSWORD=admin
TEST_ADMIN_EMAIL=admin@example.local
CRON_SECRET=replace-with-a-long-random-value
```

`npm run dev`, `npm start`, and `npm run db:seed` idempotently ensure the configured demo administrator exists. The account is a regular database user with a bcrypt password hash and the existing `SUPER_ADMIN` role; no authentication or permission bypass is used.

Development/demo login:

```text
Username: admin
Password: admin
```

These credentials are intended only for development/demo environments. Never enable `CREATE_TEST_ADMIN=true` in a normal production deployment.

The protected `/api/internal/demo-cleanup` endpoint removes expired customer and demo transaction records. The storefront also performs a throttled, best-effort cleanup on normal server requests, so the public demo remains self-cleaning on Vercel Hobby even without a frequent Cron Job. The cleanup engine refuses to run unless `DEMO_MODE=true` and uses `DEMO_DATA_TTL_MINUTES` as its age threshold.

For Vercel Pro, `vercel.pro-cron.json.example` contains an optional five-minute Cron configuration. Copy its `crons` block into `vercel.json` only when the Vercel plan supports that frequency. If `CRON_SECRET` is configured in Vercel, Vercel can secure cron requests using the corresponding Bearer authorization header.

Products, variants, inventory configuration, categories, size guides, site design, themes, CMS content, legal settings, social settings, and all administrator accounts are preserved. Confirmed demo orders restore their remaining stock before deletion.

## Branding

- Store name, logo, dark logo, favicon, colors, navigation, page content, and SEO: Visual Editor (`/visual-editor`)
- Company name, legal details, addresses, public office/support contacts, VAT settings: Admin > Legal Settings
- Social links: Admin > Social Networks
- Public domain: `NEXT_PUBLIC_SITE_URL`
- Transactional sender and order/support addresses: `EMAIL_BRAND_NAME` and the `EMAIL_*` variables
- Upload namespace: `CLOUDINARY_FOLDER_PREFIX`

When no logo is configured, the storefront displays the configured store name as a text fallback.
