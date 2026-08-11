# Deployment

## Runtime

- Node.js 20.9+
- PostgreSQL reachable from the deployment environment
- Persistent secrets supplied by the hosting platform
- Writable local disk is not required for application data

## Before Deploying

1. Configure all production variables from `docs/ENVIRONMENT.md`.
2. Use a public HTTPS value for `NEXT_PUBLIC_SITE_URL`.
3. Disable `RESEND_TEST_MODE` and `SHIPPING_FALLBACK_ENABLED`.
4. Use verified Resend, courier, payment, OAuth, and Cloudinary credentials.
5. Run the release gates:

```bash
npm run predeploy:check
npm run production:check
npm run qa
npm run build
```

## Demo Deployment

`vercel.json` schedules `GET /api/internal/demo-cleanup` every five minutes. Vercel automatically sends the configured `CRON_SECRET` as a bearer token. For another scheduler, send either `GET` or `POST` with:

```text
Authorization: Bearer <CRON_SECRET>
```

The endpoint returns `403` when `DEMO_MODE` is not enabled and `401` when the secret is absent or incorrect. Use an isolated demo database. The cleanup removes records older than `DEMO_DATA_TTL_MINUTES`; it never resets the database or calls payment and courier providers.

## Database Migration

Run this against the target database before starting the new application version:

```bash
npx prisma migrate deploy
```

Do not use `prisma db push` against production. Keep the committed migration history intact.

## Post-deploy Checks

- Storefront, search, filters, product pages, cart, checkout, and customer profile
- Registration, verification, password reset, and Google OAuth
- Order email delivery and PDF attachment
- Econt/Speedy office lookup, quotation, shipment creation, and tracking
- ePay start, return, and notification paths
- Admin roles, permissions, legal settings, uploads, reports, support/RMA, and Visual Editor
- `robots.txt`, `sitemap.xml`, canonical metadata, favicon, and OpenGraph image after branding is configured
