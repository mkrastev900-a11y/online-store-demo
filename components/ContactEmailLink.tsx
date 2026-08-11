"use client";

import { useContactEmails } from "@/components/ContactConfigProvider";
import { contactMailto, type ContactEmailPurpose } from "@/lib/contact-config";

export default function ContactEmailLink({ purpose }: { purpose: ContactEmailPurpose }) {
  const emails = useContactEmails();
  const address = emails[purpose];
  return <a href={contactMailto(address)}>{address}</a>;
}

