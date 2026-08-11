"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { markAdminNavAlertItemViewed } from "@/lib/admin-nav-alert-client";

export default function AdminAlertLink({
  href,
  alertHref,
  itemKey,
  eventVersion,
  className,
  children,
}: {
  href: string;
  alertHref: string;
  itemKey: string;
  eventVersion: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void markAdminNavAlertItemViewed({
          href: alertHref,
          itemKey,
          eventVersion,
        });
      }}
    >
      {children}
    </Link>
  );
}
