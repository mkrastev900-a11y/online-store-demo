# Environment

Use `.env.example` as the canonical variable list. Keep real values only in `.env.local` or the deployment platform's secret store.

## Core

- `DATABASE_URL`: PostgreSQL connection string.
- `DIRECT_URL`: Optional direct database connection for providers that separate pooled and direct connections.
- `AUTH_SECRET`: Long random signing secret. `SESSION_SECRET` remains a compatibility fallback.
- `NEXT_PUBLIC_SITE_URL`: Canonical public origin, such as `https://store.example`.
- `APP_URL`: Legacy compatibility alias; prefer `NEXT_PUBLIC_SITE_URL`.
- `STORE_NAME`: Store name used by integrations that cannot read database settings.
- `NEXT_PUBLIC_STORE_PHONE`: Optional phone fallback until configured in the Visual Editor.

## Demo Mode

- `DEMO_MODE`: Enables scheduled record cleanup only when exactly `true`; default `false`.
- `DEMO_DATA_TTL_MINUTES`: Positive TTL in minutes, default `30`.
- `CREATE_TEST_ADMIN`: Enables the idempotent database bootstrap only when exactly `true`; default `false`.
- `TEST_ADMIN_USERNAME`: Login alias and display name for the demo administrator.
- `TEST_ADMIN_PASSWORD`: Plain input used only by the bootstrap process to produce a bcrypt hash; never stored as plaintext.
- `TEST_ADMIN_EMAIL`: Internal unique email backing the username alias.
- `CRON_SECRET`: Secret used in the protected cleanup endpoint's bearer authorization header.

For a normal production environment, keep `DEMO_MODE=false` and `CREATE_TEST_ADMIN=false`. An intentionally public demo deployment must use an isolated database, disposable customer data, and a strong `CRON_SECRET`.

## Branding And Contacts

- `EMAIL_BRAND_NAME`: Display name in transactional emails and generated payment PDFs.
- `EMAIL_FROM`: Verified no-reply sender mailbox.
- `EMAIL_REPLY_TO`: Office/general reply address.
- `EMAIL_SUPPORT`: Support and RMA reply address.
- `EMAIL_ORDERS`: Order reply address.
- `LEGAL_*`: Fallback company details; values stored in Admin > Legal Settings take precedence.
- `CLOUDINARY_FOLDER_PREFIX`: Per-client upload namespace.

## Email

- `RESEND_API_KEY`: Resend API key.
- `RESEND_TEST_MODE`: `true` only for controlled non-production delivery.
- `RESEND_TEST_RECIPIENT`: Required in test mode.
- `ADMIN_NOTIFICATION_EMAILS`: Comma-separated order notification recipients.
- `CONTACT_RECIPIENT_EMAILS`: Comma-separated contact-form recipients.

## External Services

- `CLOUDINARY_*`: Cloudinary account credentials.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Google OAuth.
- `ECONT_*`: Econt environment, credentials, and sender identity/address.
- `SPEEDY_*`: Speedy environment, credentials, sender client, and service.
- `EPAY_*`: ePay environment, merchant number, secret, and notification URL.

## Shipping

- `SHIPPING_FREE_THRESHOLD_EUR`: Free-shipping threshold.
- `SHIPPING_FALLBACK_ENABLED`: Must be `false` in production.
- `NEXT_PUBLIC_SHIPPING_FALLBACK_PRICE_EUR`: Optional development fallback price.
- `DEFAULT_SHIPMENT_WEIGHT_KG`: Default shipment weight.
- `COD_ORDER_RESERVATION_HOURS`: Inventory reservation window for cash-on-delivery orders.

## Administration Bootstrap

- `BOOTSTRAP_SUPER_ADMIN_EMAILS`: Comma-separated registered accounts for the one-time bootstrap command.
- `BOOTSTRAP_ALLOW_UNVERIFIED`: Emergency-only override; keep `false` under normal operation.

Never place real credentials, personal addresses, or production database URLs in example or documentation files.
