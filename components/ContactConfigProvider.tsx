"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_CONTACT_EMAILS,
  type PublicContactEmails,
} from "@/lib/contact-config";

const ContactConfigContext = createContext<PublicContactEmails>(DEFAULT_CONTACT_EMAILS);

export function ContactConfigProvider({
  children,
  emails,
}: {
  children: React.ReactNode;
  emails: PublicContactEmails;
}) {
  return (
    <ContactConfigContext.Provider value={emails}>
      {children}
    </ContactConfigContext.Provider>
  );
}

export function useContactEmails() {
  return useContext(ContactConfigContext);
}

