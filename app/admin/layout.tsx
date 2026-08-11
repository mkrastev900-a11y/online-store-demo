import { requireAdmin } from "@/lib/admin";
import AdminNav from "@/components/admin/AdminNav";
import AdminRouteTransition from "@/components/admin/AdminRouteTransition";
import styles from "./admin.module.css";
import { getPermissionKeys } from "@/lib/admin-permissions";
import { getAdminNavigationAlerts } from "@/lib/admin-nav-alerts.server";
import TranslatedAdminHeader from "@/components/i18n/TranslatedAdminHeader";
import AdminHelpAssistant from "@/components/admin/AdminHelpAssistant";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const adminRole: "SUPER_ADMIN" | "ADMIN" = isSuperAdmin ? "SUPER_ADMIN" : "ADMIN";
  const permissions = isSuperAdmin ? [] : await getPermissionKeys(admin.id);
  const hasDesignAccess = isSuperAdmin || permissions.includes("WEB_DESIGN:VIEW");
  const initialAlerts = await getAdminNavigationAlerts({
    adminId: admin.id,
    isSuperAdmin,
    permissions,
  });

  return (
    <div className={styles.shell}>
      <AdminNav
        isSuperAdmin={isSuperAdmin}
        permissions={permissions}
        initialAlerts={initialAlerts}
        isDesignOwner={hasDesignAccess}
      />

      <div className={styles.workspace}>
        <TranslatedAdminHeader name={admin.name} role={adminRole} />

        <div className={styles.content}>
          <AdminRouteTransition>{children}</AdminRouteTransition>
        </div>
      </div>

      <AdminHelpAssistant
        isSuperAdmin={isSuperAdmin}
        permissions={permissions}
        isDesignOwner={hasDesignAccess}
      />
    </div>
  );
}
