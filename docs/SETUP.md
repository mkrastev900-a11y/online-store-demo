# Setup

## 1. Install

```bash
npm ci
npx prisma generate
```

Create `.env.local` from `.env.example` and provide installation-specific values.

## 2. Database

Create an empty PostgreSQL database, set `DATABASE_URL`, then run:

```bash
npx prisma migrate deploy
npm run db:seed
```

The seed contains only generic development categories and products. Skip it for an empty production catalog.

## 3. First Owner

Start the app, register and verify the owner's account, then run the explicit bootstrap:

```bash
npm run db:super-admins
```

`BOOTSTRAP_SUPER_ADMIN_EMAILS` must contain one or more already registered email addresses. Remove the variable after the bootstrap succeeds.

## 4. Configure the Store

- Set identity, logos, favicon, colors, navigation, content, and SEO in the Visual Editor.
- Set legal company details and public contacts in Admin > Legal Settings.
- Set social profiles in Admin > Social Networks.
- Configure email, uploads, payments, and couriers through environment variables.

## 5. Verify

```bash
npm run test
npm run lint
npm run typecheck
npx prisma validate
npm run build
```

