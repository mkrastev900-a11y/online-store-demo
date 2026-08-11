"use client";

import { useState } from "react";

import { markAdminNavAlertItemViewed } from "@/lib/admin-nav-alert-client";

import styles from "./AdminAlertReviewButton.module.css";

export default function AdminAlertReviewButton({
  href,
  itemKey,
  eventVersion,
  label = "Прегледано",
}: {
  href: string;
  itemKey: string;
  eventVersion: string;
  label?: string;
}) {
  const [seen, setSeen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (seen) return <span className={styles.seen} data-alert-viewed="true">✓ Прегледано</span>;

  return (
    <button
      className={styles.button}
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const saved = await markAdminNavAlertItemViewed({
          href,
          itemKey,
          eventVersion,
        });
        if (saved) setSeen(true);
        setBusy(false);
      }}
    >
      {busy ? "Записване…" : label}
    </button>
  );
}
