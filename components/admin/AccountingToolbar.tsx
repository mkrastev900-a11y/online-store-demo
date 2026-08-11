"use client";

import { useRouter } from "next/navigation";
import type { AccountingPeriod } from "@/lib/internal-accounting";
import { ACCOUNTING_PERIOD_LABELS, ACCOUNTING_PERIODS } from "@/lib/internal-accounting";
import styles from "@/app/admin/accounting/accounting.module.css";

export default function AccountingToolbar({ period }: { period: AccountingPeriod }) {
  const router = useRouter();

  return (
    <div className={styles.toolbar} data-print-hidden>
      <label>
        <span>Период</span>
        <select
          value={period}
          onChange={(event) => router.push(`/admin/accounting?period=${event.target.value}`)}
        >
          {ACCOUNTING_PERIODS.map((value) => (
            <option key={value} value={value}>{ACCOUNTING_PERIOD_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => window.print()}>
        Генерирай PDF
      </button>
    </div>
  );
}
