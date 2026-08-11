"use client";

import { useEffect } from "react";

import { markAdminNavAlertItemViewed } from "@/lib/admin-nav-alert-client";

export default function AdminAlertItemSeen({
  href,
  itemKey,
  eventVersion,
}: {
  href: string;
  itemKey: string;
  eventVersion: string;
}) {
  useEffect(() => {
    void markAdminNavAlertItemViewed({ href, itemKey, eventVersion });
  }, [eventVersion, href, itemKey]);

  return null;
}
