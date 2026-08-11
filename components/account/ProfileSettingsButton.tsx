import Link from "next/link";
import styles from "@/app/account/account.module.css";

export default function ProfileSettingsButton() {
  return (
    <Link
      href="/account/settings"
      className={styles.settingsButton}
      aria-label="Отвори настройките на профила"
      title="Настройки на профила"
    >
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
        <path
          d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Zm9 3.75c0-.5-.04-.98-.12-1.45l2.02-1.58-2-3.46-2.48 1a9.2 9.2 0 0 0-2.5-1.45L15.55 2.4h-4l-.37 2.66a9.2 9.2 0 0 0-2.5 1.45l-2.48-1-2 3.46 2.02 1.58A9 9 0 0 0 6.1 12c0 .5.04.98.12 1.45L4.2 15.03l2 3.46 2.48-1a9.2 9.2 0 0 0 2.5 1.45l.37 2.66h4l.37-2.66a9.2 9.2 0 0 0 2.5-1.45l2.48 1 2-3.46-2.02-1.58c.08-.47.12-.95.12-1.45Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.srOnly}>Настройки</span>
    </Link>
  );
}
