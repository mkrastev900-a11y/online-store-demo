import { DEFAULT_STORE_NAME } from "@/lib/brand";

export type TransactionalEmailCategory = "system" | "order" | "support";

export const EMAIL_BRAND_NAME = process.env.EMAIL_BRAND_NAME?.trim() || DEFAULT_STORE_NAME;
export const EMAIL_BRAND_NAME_UPPER = EMAIL_BRAND_NAME.toLocaleUpperCase("en-US");

export type EmailAddressConfig = {
  from: string;
  fromAddress: string;
  officeAddress?: string;
  supportAddress?: string;
  ordersAddress?: string;
  replyTo: Record<TransactionalEmailCategory, string | undefined>;
};

export class EmailConfigurationError extends Error {
  constructor(issues: string[]) {
    super(`Невалидна email конфигурация: ${issues.join(" ")}`);
    this.name = "EmailConfigurationError";
  }
}

function value(name: string) {
  return process.env[name]?.trim() ?? "";
}

function mailbox(valueToNormalize: string) {
  const namedAddress = valueToNormalize.match(/<([^<>]+)>/);
  return (namedAddress?.[1] ?? valueToNormalize).trim();
}

function isMailbox(valueToCheck: string | undefined) {
  return !valueToCheck || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(valueToCheck);
}

export function validateEmailAddressConfig(config: EmailAddressConfig, strictLiveProduction: boolean) {
  const issues: string[] = [];

  if (!config.fromAddress) issues.push("Липсва EMAIL_FROM.");
  else if (!isMailbox(config.fromAddress)) issues.push("EMAIL_FROM не е валиден email адрес.");

  const replyAddresses = [
    ["EMAIL_REPLY_TO", config.officeAddress],
    ["EMAIL_SUPPORT", config.supportAddress],
    ["EMAIL_ORDERS", config.ordersAddress],
  ] as const;

  for (const [name, address] of replyAddresses) {
    if (strictLiveProduction && !address) issues.push(`Липсва ${name}.`);
    else if (!isMailbox(address)) issues.push(`${name} не е валиден email адрес.`);
  }

  if (strictLiveProduction && /@resend\.dev$/i.test(config.fromAddress)) {
    issues.push("Production изпращачът не може да бъде от resend.dev.");
  }

  return issues;
}

export function getEmailAddressConfig(): EmailAddressConfig {
  const testMode = value("RESEND_TEST_MODE") === "true";
  const strictLiveProduction = process.env.NODE_ENV === "production" && !testMode;
  const legacyAllowed = !strictLiveProduction;

  const fromAddress = mailbox(value("EMAIL_FROM") || (legacyAllowed ? value("RESEND_FROM_EMAIL") : ""));
  const officeAddress = mailbox(value("EMAIL_REPLY_TO") || (legacyAllowed ? value("RESEND_REPLY_TO_EMAIL") : "")) || undefined;
  const supportAddress = mailbox(value("EMAIL_SUPPORT") || (legacyAllowed ? officeAddress ?? "" : "")) || undefined;
  const ordersAddress = mailbox(value("EMAIL_ORDERS") || (legacyAllowed ? officeAddress ?? "" : "")) || undefined;

  const config: EmailAddressConfig = {
    from: fromAddress ? `${EMAIL_BRAND_NAME} <${fromAddress}>` : "",
    fromAddress,
    officeAddress,
    supportAddress,
    ordersAddress,
    replyTo: {
      system: officeAddress,
      order: ordersAddress,
      support: supportAddress,
    },
  };

  const issues = validateEmailAddressConfig(config, strictLiveProduction);
  if (issues.length) throw new EmailConfigurationError(issues);
  return config;
}

export function getTransactionalEmailEnvelope(category: TransactionalEmailCategory) {
  const config = getEmailAddressConfig();
  return { from: config.from, replyTo: config.replyTo[category] };
}
