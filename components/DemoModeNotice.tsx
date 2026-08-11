import { getDemoDataTtlMinutes, isDemoModeEnabled } from "@/lib/demo-mode";

import styles from "./DemoModeNotice.module.css";

export default function DemoModeNotice() {
  if (!isDemoModeEnabled()) return null;
  const ttlMinutes = getDemoDataTtlMinutes();

  return (
    <aside className={styles.notice} role="status">
      <strong>Демо режим</strong>
      <span>Тестовите данни се изтриват автоматично след {ttlMinutes} минути.</span>
    </aside>
  );
}
