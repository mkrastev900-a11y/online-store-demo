# V9 — Public demo login diagnostics / resilience

- `/api/auth/login` now logs the actual caught server exception to Vercel Runtime Logs.
- A failure to update the secondary `lastLoginAt` field no longer blocks an otherwise valid login/session.
- No authentication bypass was added. Password hashing, session JWT, SUPER_ADMIN role and normal permission checks remain unchanged.
