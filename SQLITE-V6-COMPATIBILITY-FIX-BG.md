# SQLite V6 compatibility fix

Поправени runtime несъвместимости за локалната SQLite demo версия:

- премахнато `skipDuplicates` от Prisma `createMany`;
- default product attributes вече се зареждат idempotent чрез `upsert`;
- admin permissions вече се създават idempotent чрез composite-key `upsert`;
- премахнат Prisma `mode: "insensitive"`, който не се поддържа от SQLite connector;
- проверката за дублирани продуктови атрибути е provider-portable и сравнява нормализирани стойности в приложението;
- CMS auto-DDL остава изключен при `file:`/SQLite, защото таблиците се създават от Prisma schema/db push.

PostgreSQL migration history и maintenance scripts са запазени като исторически/служебни файлове и не се изпълняват от `START-DEMO.cmd`.
