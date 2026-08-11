import { existsSync, readFileSync } from "node:fs";

const env = (name) => (process.env[name] || "").trim();
const errors = [];
const warnings = [];

const required = ["DATABASE_URL", "AUTH_SECRET"];
for (const key of required) if (!env(key)) errors.push(`Липсва ${key}.`);

const appUrl = env("NEXT_PUBLIC_SITE_URL") || env("APP_URL");
if (!appUrl) errors.push("Липсва NEXT_PUBLIC_SITE_URL.");
if (appUrl && !/^https:\/\//i.test(appUrl)) errors.push("NEXT_PUBLIC_SITE_URL трябва да е публичен HTTPS адрес в production.");

if (env("SHIPPING_FALLBACK_ENABLED") === "true") {
  errors.push("SHIPPING_FALLBACK_ENABLED=true не е допустимо за финален production release.");
}

const demoMode = env("DEMO_MODE") === "true";
const testAdminEnabled = env("CREATE_TEST_ADMIN") === "true";
if (testAdminEnabled && !demoMode) {
  errors.push("CREATE_TEST_ADMIN=true е допустимо само за explicit DEMO_MODE=true deployment.");
}
if (demoMode) {
  warnings.push("Deployment-ът е в explicit demo mode и customer transaction данните са временни.");
  if (!env("CRON_SECRET")) errors.push("DEMO_MODE=true изисква CRON_SECRET за protected cleanup scheduler-а.");
}
if (testAdminEnabled) {
  for (const key of ["TEST_ADMIN_USERNAME", "TEST_ADMIN_PASSWORD", "TEST_ADMIN_EMAIL"]) {
    if (!env(key)) errors.push(`CREATE_TEST_ADMIN=true изисква ${key}.`);
  }
}

if (env("RESEND_TEST_MODE") !== "false") {
  warnings.push("Resend все още е в test mode. Преди live email delivery задай RESEND_TEST_MODE=false след верифициран sender domain.");
}
if (!env("RESEND_API_KEY")) warnings.push("RESEND_API_KEY не е конфигуриран.");
for (const key of ["EMAIL_FROM", "EMAIL_REPLY_TO", "EMAIL_SUPPORT", "EMAIL_ORDERS"]) {
  if (!env(key)) warnings.push(`${key} не е конфигуриран.`);
}

if ((env("ECONT_ENV") || "demo") !== "production") {
  warnings.push("Econt е в demo режим.");
} else if (!env("ECONT_USERNAME") || !env("ECONT_PASSWORD")) {
  errors.push("Econt production е избран, но липсват credentials.");
}

if (env("SPEEDY_ENV") === "demo" || !env("SPEEDY_USERNAME") || !env("SPEEDY_PASSWORD")) {
  warnings.push("Speedy няма потвърдени live credentials.");
}

if ((env("EPAY_ENV") || "demo") !== "production") {
  warnings.push("ePay е в demo режим.");
} else if (!env("EPAY_MIN") || !env("EPAY_SECRET")) {
  errors.push("ePay production е избран, но липсват EPAY_MIN/EPAY_SECRET.");
}

if (existsSync("vercel.json")) {
  try {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const cron of vercel.crons || []) {
      const routePath = `app${cron.path}/route.ts`;
      if (!existsSync(routePath)) errors.push(`Vercel cron сочи към липсващ route: ${cron.path}`);
    }
  } catch {
    errors.push("vercel.json не е валиден JSON.");
  }
}

console.log("ONLINE STORE — production readiness");
console.log(`Core config: ${errors.some((e) => /DATABASE_URL|AUTH_SECRET|NEXT_PUBLIC_SITE_URL/.test(e)) ? "INCOMPLETE" : "OK"}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log("Code/config gate passed. External integrations marked as warnings still require live credentials/smoke tests.");
