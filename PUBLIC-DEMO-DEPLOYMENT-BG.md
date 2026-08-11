# PUBLIC DEMO — GitHub + Vercel + Neon

Тази версия е предназначена за публично демо пред бъдещи купувачи.

## Архитектура

- GitHub: source repository
- Vercel: Next.js deployment
- Neon: PostgreSQL database
- Demo admin: `admin / admin`, реален `SUPER_ADMIN` database профил с display name `Админ`
- Demo TTL: 30 минути

## 1. GitHub

Създай празно repository, например `online-store-demo`, без README/License/.gitignore от GitHub.

В папката на проекта:

```cmd
git init
git add .
git commit -m "Initial public demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/online-store-demo.git
git push -u origin main
```

`.env`, `.env.local`, локални database файлове и ZIP архиви са игнорирани и не трябва да се качват.

## 2. Neon

Създай нов, празен Neon project/database само за demo средата.

В Neon → Connect копирай PostgreSQL connection string. За runtime трафик използвай pooled connection string.

Не записвай URL-а в GitHub. Той се добавя само във Vercel Environment Variables като `DATABASE_URL`.

## 3. Vercel

Vercel → Add New → Project → Import Git Repository → избери `online-store-demo`.

Framework: Next.js.

`vercel.json` вече задава:

```text
Build Command: npm run vercel:build
```

Този command:

1. генерира Prisma Client;
2. синхронизира празната Neon база от `schema.prisma`;
3. зарежда началния demo каталог;
4. създава/проверява `admin / admin`;
5. build-ва Next.js.

## 4. Задължителни Vercel Environment Variables

Добави поне:

```env
DATABASE_URL=<NEON_POOLED_POSTGRESQL_URL>
AUTH_SECRET=<LONG_RANDOM_SECRET>
SESSION_SECRET=<LONG_RANDOM_SECRET>
NEXT_PUBLIC_SITE_URL=https://YOUR_PROJECT.vercel.app
APP_URL=https://YOUR_PROJECT.vercel.app

DEMO_MODE=true
DEMO_DATA_TTL_MINUTES=30

CREATE_TEST_ADMIN=true
TEST_ADMIN_USERNAME=admin
TEST_ADMIN_PASSWORD=admin
TEST_ADMIN_EMAIL=admin@example.local
TEST_ADMIN_DISPLAY_NAME=Админ

CRON_SECRET=<LONG_RANDOM_SECRET>
```

След първия Vercel deployment замени `YOUR_PROJECT.vercel.app` с реалния Vercel URL и направи Redeploy.

## 5. Demo admin

Login:

```text
Потребител: admin
Парола: admin
```

Това НЕ е authentication bypass. Профилът е реален database User с bcrypt password hash и role `SUPER_ADMIN`.

След login потребителят се връща към началната страница `/`, вижда профил `Админ` и бутон `АДМИН` с пълните права на съществуващата permission система.

## 6. 30-минутно автоматично чистене

При `DEMO_MODE=true` customer/demo transaction data с възраст над 30 минути се почиства.

Запазват се:

- demo admin и другите admin профили;
- продукти и варианти;
- категории/секции;
- размери/атрибути;
- Visual Editor/design/theme configuration;
- system/legal/social settings.

Public Vercel Hobby deployment използва built-in best-effort cleanup при нормални server requests. Това означава, че ако няма никакъв трафик, старите записи могат физически да останат до следващото посещение, но се отстраняват при следващото server request изпълнение.

### Vercel Pro — optional exact scheduler

`vercel.pro-cron.json.example` съдържа пример за cleanup на всеки 5 минути:

```json
{
  "path": "/api/internal/demo-cleanup",
  "schedule": "*/5 * * * *"
}
```

При Pro можеш да добавиш този `crons` блок във `vercel.json`.

## 7. Не включвай реални production credentials

За публичното demo не добавяй реални:

- ePay production credentials;
- Econt/Speedy production credentials;
- реални фирмени банкови данни;
- production customer email lists;
- лични API keys, които не са необходими.

Courier/payment integrations трябва да останат в demo/test mode, докато сайтът се използва от непознати посетители.

## 8. След deployment

Провери:

1. `/` се зарежда;
2. `/login` приема `admin / admin`;
3. след login се връща `/`;
4. header показва `Админ`;
5. бутон `АДМИН` се вижда;
6. `/admin` се отваря с SUPER_ADMIN права;
7. могат да се създават тестови потребители/поръчки;
8. cleanup endpoint отказва без валиден `CRON_SECRET`;
9. данни над TTL се почистват, без да се трие каталогът/admin-ът.

### Постоянни социални мрежи

Настройките за Facebook, Instagram и TikTok са системна конфигурация и не участват в 30-минутния cleanup. URL адресите и enabled/visible отметките остават, докато администратор не ги промени ръчно.
