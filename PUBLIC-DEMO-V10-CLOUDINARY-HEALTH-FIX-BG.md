# V10 — Cloudinary health/runtime alignment

- System Health вече проверява Cloudinary чрез официалния Node SDK (`api.ping()`), същата конфигурация, която използват upload/delete routes.
- Cloudinary ENV стойностите толерират случайно поставени външни кавички или `KEY=value` във Vercel value полето.
- Database health label показва `Neon PostgreSQL` при PostgreSQL DATABASE_URL вместо старото `Local SQLite`.
- При Cloudinary грешка System Health показва безопасното съобщение от SDK без да показва secret стойности.
