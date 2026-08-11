"use client";

import type { AccountingPeriod } from "@/lib/internal-accounting";
import { ACCOUNTING_PERIOD_LABELS, ACCOUNTING_PERIODS } from "@/lib/internal-accounting";
import styles from "@/app/admin/accounting/accounting.module.css";

export default function OfficialAccountingToolbar({ period }: { period: AccountingPeriod }) {
  return (
    <div className={styles.toolbar} data-print-hidden>
      <button type="button" onClick={() => window.location.assign(`/admin/accounting?period=${period}`)}>
        Вътрешен отчет
      </button>
      <label>
        <span>Период</span>
        <select
          value={period}
          onChange={(event) => window.location.assign(`/admin/accounting/official?period=${event.target.value}`)}
        >
          {ACCOUNTING_PERIODS.map((value) => (
            <option key={value} value={value}>{ACCOUNTING_PERIOD_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <a className={styles.exportLink} href={`/api/admin/accounting/official.csv?period=${period}`}>
        CSV
      </a>
      <button type="button" onClick={() => window.print()}>
        PDF / печат
      </button>
    </div>
  );
}
