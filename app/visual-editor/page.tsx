import type { Metadata } from "next";
import WebDesignEditor from "@/components/admin/WebDesignEditor";
import { getDesignStudioState } from "@/lib/design-studio";
import AdminHelpAssistant from "@/components/admin/AdminHelpAssistant";
import { getPermissionKeys, requireAdminPermission } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Визуален редактор | Online Store",
  robots: { index: false, follow: false },
};

export default async function VisualEditorPage() {
  const admin = await requireAdminPermission("WEB_DESIGN:VIEW");
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const permissions = isSuperAdmin ? [] : await getPermissionKeys(admin.id);

  return (
    <>
      <WebDesignEditor initialState={await getDesignStudioState()} standalone />
      <AdminHelpAssistant
        isSuperAdmin={isSuperAdmin}
        permissions={permissions}
        isDesignOwner
      />
    </>
  );
}
