const value = (name) => (process.env[name] || "").trim();

const apiKey = value("RESEND_API_KEY");
const from = value("EMAIL_FROM");
const replyTo = value("EMAIL_REPLY_TO");
const support = value("EMAIL_SUPPORT");
const orders = value("EMAIL_ORDERS");
const appUrl = value("NEXT_PUBLIC_SITE_URL") || value("APP_URL");
const testMode = value("RESEND_TEST_MODE") === "true";
const testRecipient = value("RESEND_TEST_RECIPIENT");
const legacyFrom = value("RESEND_FROM_EMAIL");

const issues = [];
const warnings = [];

if (!apiKey) issues.push("Липсва RESEND_API_KEY.");
if (!from && !testMode) issues.push("Липсва EMAIL_FROM.");
if (!replyTo && !testMode) issues.push("Липсва EMAIL_REPLY_TO.");
if (!support && !testMode) issues.push("Липсва EMAIL_SUPPORT.");
if (!orders && !testMode) issues.push("Липсва EMAIL_ORDERS.");
if (testMode && !from && !legacyFrom) issues.push("Липсва EMAIL_FROM или development/test RESEND_FROM_EMAIL.");
if (!appUrl) issues.push("Липсва NEXT_PUBLIC_SITE_URL.");
if (testMode && !testRecipient) issues.push("RESEND_TEST_MODE=true, но липсва RESEND_TEST_RECIPIENT.");
if (testMode && (!from || !replyTo || !support || !orders)) warnings.push("Test mode използва legacy/fallback адресна конфигурация; за live production задай всички EMAIL_* адреси.");
if (!testMode && /onboarding@resend\.dev/i.test(from)) {
  issues.push("Production режимът не трябва да използва onboarding@resend.dev. Верифицирай собствен домейн в Resend.");
}
if (!testMode && !/^https:\/\//i.test(appUrl)) {
  warnings.push("За production NEXT_PUBLIC_SITE_URL трябва да е публичният HTTPS адрес на магазина.");
}

console.log("Online Store — email configuration check");
console.log(`Mode: ${testMode ? "TEST" : "PRODUCTION"}`);
console.log(`Sender configured: ${from || (testMode && legacyFrom) ? "yes" : "no"}`);
console.log(`Reply-To configured: ${replyTo ? "yes" : "no"}`);
console.log(`Support address configured: ${support ? "yes" : "no"}`);
console.log(`Orders address configured: ${orders ? "yes" : "no"}`);
console.log(`Site URL configured: ${appUrl ? "yes" : "no"}`);

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const issue of issues) console.error(`ERROR: ${issue}`);

if (issues.length) process.exit(1);
console.log("Email configuration is structurally ready.");
