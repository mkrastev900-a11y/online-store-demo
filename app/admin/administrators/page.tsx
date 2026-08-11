import AdministratorsPanel from "@/components/admin/AdministratorsPanel";
import { listUsersForRoleManagement } from "@/lib/admin-users";
import { hasAdminPermission, requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdministratorsPage() {
  const admin = await requireAdminPermission("ADMINISTRATORS:VIEW");
  const canManage = await hasAdminPermission(admin.id, admin.role, "ADMINISTRATORS:MANAGE");
  const users = (await listUsersForRoleManagement()) ?? [];

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div><span>РОЛИ И ДОСТЪП</span><h1>Администратори</h1></div>
      </div>
      <AdministratorsPanel users={users} currentAdminId={admin.id} canManage={canManage} canManageSuperAdmins={admin.role === "SUPER_ADMIN"} />
    </main>
  );
}
