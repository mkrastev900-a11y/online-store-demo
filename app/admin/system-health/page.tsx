import SystemHealthDashboard from "@/components/admin/SystemHealthDashboard";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getSystemHealthSnapshot } from "@/lib/system-health";
import { getUnreadAdminNavItemKeys } from "@/lib/admin-nav-alerts.server";
import styles from "./health.module.css";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const admin = await requireAdminPermission("SYSTEM_HEALTH:VIEW");
  const snapshot = await getSystemHealthSnapshot();
  const warningKeys = [
    !Boolean(process.env.SESSION_SECRET || process.env.AUTH_SECRET) ? "session-secret" : null,
    !Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) ? "cloudinary" : null,
    !Boolean(process.env.RESEND_API_KEY) ? "resend" : null,
  ].filter((key): key is string => Boolean(key));
  const unreadKeys = await getUnreadAdminNavItemKeys(
    admin.id,
    "/admin/system-health",
    warningKeys.map((key) => ({ itemKey: `warning:${key}`, eventVersion: "missing" })),
  );
  return <main className={styles.main}><SystemHealthDashboard initialSnapshot={snapshot} configurationAlertKeys={warningKeys.filter((key) => unreadKeys.has(`warning:${key}`))} /></main>;
}
