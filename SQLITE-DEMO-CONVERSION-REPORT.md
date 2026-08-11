# SQLite Demo Conversion Report

- Prisma datasource changed from PostgreSQL to SQLite (`file:./demo.db`).
- PostgreSQL native `@db.*` annotations removed from the demo schema.
- PostgreSQL-only row locks (`FOR UPDATE`) removed from runtime paths; SQLite transactions serialize writes at the database level.
- PostgreSQL-only unread-count SQL and rate-limit UPSERT SQL were replaced with Prisma Client operations.
- CMS runtime PostgreSQL schema-repair SQL is bypassed for SQLite because `prisma db push` owns the local schema.
- Product aggregate stock is explicitly synchronized when stock is adjusted, instead of depending on the old PostgreSQL trigger.
- Startup uses `prisma db push` + seed instead of PostgreSQL migrations.
- `START-DEMO.cmd` requires only Node/npm and starts a standalone cleanup scheduler.
- Demo SUPER_ADMIN remains `admin / admin`.
- Demo/customer data TTL is 30 minutes.
- No Docker, Neon, or PostgreSQL service is required.

Validation performed in this environment: static scan for runtime PostgreSQL-only SQL and Node syntax validation of the cleanup scheduler. Full Prisma generation/build could not be executed in the isolated container because project dependencies were not locally installed and external package installation was unavailable. The Windows start script performs Prisma generation and schema push before launching the app.
