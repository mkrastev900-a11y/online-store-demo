const env = (name) => (process.env[name] || "").trim();
const issues = [];
const warnings = [];

const econtEnv = env("ECONT_ENV") || "demo";
const econtProduction = econtEnv === "production";
const econtUser = env("ECONT_USERNAME");
const econtPass = env("ECONT_PASSWORD");
const econtOffice = env("ECONT_SENDER_OFFICE_CODE");
const econtSenderName = env("ECONT_SENDER_NAME");
const econtSenderPhone = env("ECONT_SENDER_PHONE");
const econtAddressComplete = ["ECONT_SENDER_CITY","ECONT_SENDER_POST_CODE","ECONT_SENDER_STREET","ECONT_SENDER_STREET_NUMBER"].every((key) => env(key));

if (econtProduction) {
  if (!econtUser || !econtPass) issues.push("Еконт production изисква ECONT_USERNAME и ECONT_PASSWORD.");
  if (!econtSenderName || !econtSenderPhone) issues.push("Еконт production изисква реални ECONT_SENDER_NAME и ECONT_SENDER_PHONE.");
  if (!econtOffice && !econtAddressComplete) issues.push("Еконт production изисква ECONT_SENDER_OFFICE_CODE или пълен адрес на подателя.");
}

const speedyDemo = env("SPEEDY_ENV") === "demo";
const speedyUser = env("SPEEDY_USERNAME");
const speedyPass = env("SPEEDY_PASSWORD");
if (!speedyDemo && (!speedyUser || !speedyPass)) {
  warnings.push("Speedy live credentials не са конфигурирани. За production са нужни SPEEDY_USERNAME и SPEEDY_PASSWORD.");
}
if (!speedyDemo && !env("SPEEDY_SENDER_CLIENT_ID")) {
  warnings.push("SPEEDY_SENDER_CLIENT_ID не е зададен; API ще използва клиента на логнатия Speedy потребител.");
}

const fallback = env("SHIPPING_FALLBACK_ENABLED") === "true";
if (fallback) warnings.push("SHIPPING_FALLBACK_ENABLED=true. Изключи го в production, за да не приемаш поръчки с фиктивна куриерска цена.");

console.log("Online Store — courier configuration check");
console.log(`Econt: ${econtProduction ? "PRODUCTION" : "DEMO"}`);
console.log(`Speedy: ${speedyDemo ? "DEMO" : "LIVE/NOT CONFIGURED"}`);
console.log(`Shipping fallback: ${fallback ? "ENABLED" : "DISABLED"}`);

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const issue of issues) console.error(`ERROR: ${issue}`);
if (issues.length) process.exit(1);
console.log("Courier configuration is structurally safe for the selected modes.");
