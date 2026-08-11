/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { prisma } from "@/lib/prisma";
import { DEFAULT_STORE_NAME } from "@/lib/brand";
import { resolvePublicContactEmails } from "@/lib/contact-config";
import { getPublicSiteUrl } from "@/lib/site-url";

export type PublicLegalSettings = {
  companyName: string;
  companyId: string;
  vatNumber: string;
  isVatRegistered: boolean;
  defaultVatRate: string;
  registeredAddress: string;
  correspondenceAddress: string;
  contactEmail: string;
  contactPhone: string;
  representativeName: string;
  websiteUrl: string;
  complaintsEmail: string;
  returnsAddress: string;
};

const clean = (value: string | null | undefined, fallback = "Не е конфигуриран") => value?.trim() || fallback;

export async function getLegalSettings(): Promise<PublicLegalSettings> {
  let row: any = null;
  try { row = await (prisma as any).legalSettings.findUnique({ where: { id: 1 } }); } catch {}

  const envVatNumber = (process.env.LEGAL_VAT_NUMBER || "").trim();
  const legacyVatFallback = row?.isVatRegistered == null && Boolean((row?.vatNumber || envVatNumber || "").trim());
  const isVatRegistered = typeof row?.isVatRegistered === "boolean" ? row.isVatRegistered : legacyVatFallback;
  const defaultVatRate = Number(row?.defaultVatRate ?? process.env.LEGAL_DEFAULT_VAT_RATE ?? 20);
  const contactEmails = resolvePublicContactEmails({
    office: row?.contactEmail || process.env.LEGAL_CONTACT_EMAIL,
    support: row?.complaintsEmail || row?.contactEmail || process.env.LEGAL_CONTACT_EMAIL,
  });

  return {
    companyName: clean(row?.companyName, process.env.LEGAL_COMPANY_NAME || DEFAULT_STORE_NAME),
    companyId: clean(row?.companyId, process.env.LEGAL_COMPANY_ID),
    vatNumber: clean(row?.vatNumber, envVatNumber || ""),
    isVatRegistered,
    defaultVatRate: Number.isFinite(defaultVatRate) ? defaultVatRate.toFixed(2) : "20.00",
    registeredAddress: clean(row?.registeredAddress, process.env.LEGAL_COMPANY_ADDRESS),
    correspondenceAddress: clean(row?.correspondenceAddress, process.env.LEGAL_CORRESPONDENCE_ADDRESS || row?.registeredAddress || process.env.LEGAL_COMPANY_ADDRESS),
    contactEmail: contactEmails.office,
    contactPhone: clean(row?.contactPhone, process.env.LEGAL_CONTACT_PHONE),
    representativeName: clean(row?.representativeName, process.env.LEGAL_REPRESENTATIVE_NAME),
    websiteUrl: clean(row?.websiteUrl, getPublicSiteUrl()),
    complaintsEmail: contactEmails.support,
    returnsAddress: clean(row?.returnsAddress, row?.correspondenceAddress || row?.registeredAddress || process.env.LEGAL_COMPANY_ADDRESS),
  };
}
