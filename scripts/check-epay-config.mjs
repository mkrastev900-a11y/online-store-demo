const env = (name) => (process.env[name] || "").trim();
const issues = [];
const warnings = [];

const mode = env("EPAY_ENV") === "production" ? "production" : "demo";
const min = env("EPAY_MIN");
const secret = env("EPAY_SECRET");
const appUrl = env("NEXT_PUBLIC_SITE_URL") || env("APP_URL");
const notifyUrl = env("EPAY_NOTIFICATION_URL");

if (!min) issues.push("Липсва EPAY_MIN.");
if (!secret) issues.push("Липсва EPAY_SECRET.");
if (!appUrl) issues.push("Липсва NEXT_PUBLIC_SITE_URL.");

if (mode === "production") {
  if (!/^https:\/\//i.test(appUrl)) issues.push("Production NEXT_PUBLIC_SITE_URL трябва да е публичен HTTPS адрес.");
  if (!notifyUrl) warnings.push("EPAY_NOTIFICATION_URL не е описан локално. Увери се, че notification URL е регистриран при ePay.");
  if (notifyUrl && !/^https:\/\//i.test(notifyUrl)) issues.push("Production EPAY_NOTIFICATION_URL трябва да е HTTPS.");
}

console.log("Online Store — ePay configuration check");
console.log(`Mode: ${mode.toUpperCase()}`);
console.log(`MIN configured: ${min ? "yes" : "no"}`);
console.log(`Secret configured: ${secret ? "yes" : "no"}`);
console.log(`Site URL configured: ${appUrl ? "yes" : "no"}`);
console.log(`Notification URL documented: ${notifyUrl ? "yes" : "no"}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const issue of issues) console.error(`ERROR: ${issue}`);
if (issues.length) process.exit(1);
console.log("ePay configuration is structurally safe for the selected mode.");
