"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import AdminGlobalSearch from "@/components/admin/AdminGlobalSearch";
import { useI18n } from "./I18nProvider";
import styles from "@/app/admin/admin.module.css";

export default function TranslatedAdminHeader({ name, role }: { name: string; role: "SUPER_ADMIN" | "ADMIN" }) {
  const { t } = useI18n();
  return <header className={styles.header}>
    <div className={styles.headerCopy}><span>{t("admin.panel")}</span><strong>{t("admin.manageStore")}</strong></div>
    <AdminGlobalSearch />
    <div className={styles.headerActions}>
      <ThemeToggle compact />
      <div className={styles.userBox}><div><span>{t("admin.loggedAs")}</span><strong>{name}</strong><small>{role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.subAdmin")}</small></div><Link href="/account" aria-label={t("admin.openProfile")}>{name.charAt(0).toUpperCase()}</Link></div>
    </div>
  </header>;
}
