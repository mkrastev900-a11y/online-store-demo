import AdminHelpAssistant from "@/components/admin/AdminHelpAssistant";
import { requireAdmin } from "@/lib/admin";
import { getPermissionKeys } from "@/lib/admin-permissions";

export const metadata = {
  title: "Помощник | Online Store Admin",
};

export default async function AdminHelpPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const permissions = isSuperAdmin ? [] : await getPermissionKeys(admin.id);
  return (
    <AdminHelpAssistant
      mode="page"
      isSuperAdmin={isSuperAdmin}
      permissions={permissions}
      isDesignOwner={isSuperAdmin || permissions.includes("WEB_DESIGN:VIEW")}
    />
  );
}
