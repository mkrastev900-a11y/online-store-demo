import Image from "next/image";
import styles from "./AuthForm.module.css";

type GoogleAuthButtonProps = {
  href: string;
  action: "login" | "register";
};

const labels = {
  login: "Вход с Google",
  register: "Регистрация с Google",
} as const;

export default function GoogleAuthButton({ href, action }: GoogleAuthButtonProps) {
  const label = labels[action];

  return <a className={styles.googleButton} href={href} aria-label={label}>
    <span className={styles.googleIcon} aria-hidden="true">
      <Image className={styles.googleLogo} src="/google-g-logo.png" alt="" width={200} height={204} priority />
    </span>
    <span className={styles.googleButtonLabel}>{label}</span>
  </a>;
}
