export const DEFAULT_CONTACT_EMAILS = {
  office: "office@example.com",
  orders: "orders@example.com",
  support: "support@example.com",
} as const;

export type ContactEmailPurpose = keyof typeof DEFAULT_CONTACT_EMAILS;
export type PublicContactEmails = Record<ContactEmailPurpose, string>;

function mailbox(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate : "";
}

export function resolvePublicContactEmails(
  overrides: Partial<PublicContactEmails> = {},
): PublicContactEmails {
  const office =
    mailbox(overrides.office) ||
    mailbox(process.env.EMAIL_REPLY_TO) ||
    mailbox(process.env.LEGAL_CONTACT_EMAIL) ||
    DEFAULT_CONTACT_EMAILS.office;
  const orders =
    mailbox(overrides.orders) ||
    mailbox(process.env.EMAIL_ORDERS) ||
    office ||
    DEFAULT_CONTACT_EMAILS.orders;
  const support =
    mailbox(overrides.support) ||
    mailbox(process.env.EMAIL_SUPPORT) ||
    office ||
    DEFAULT_CONTACT_EMAILS.support;

  return { office, orders, support };
}

export function contactMailto(address: string) {
  return `mailto:${address}`;
}

export function normalizePublicContactEmail(
  value: string | null | undefined,
  purpose: ContactEmailPurpose,
) {
  return mailbox(value) || resolvePublicContactEmails()[purpose];
}
