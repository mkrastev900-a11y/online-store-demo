# V11 — постоянни социални мрежи в demo режима

Facebook, Instagram и TikTok настройките са **постоянна системна конфигурация**.

30-минутният demo cleanup НЕ изтрива и НЕ нулира:

- Facebook URL;
- Instagram URL;
- TikTok URL;
- отметките за показване на иконите;
- останалия `SiteDesignSettings` запис.

Стойностите остават в Neon PostgreSQL, докато SUPER_ADMIN не ги промени ръчно.

Добавен е regression тест `tests/demo-social-settings-persistence.test.ts`, който пази това поведение при бъдещи промени.
