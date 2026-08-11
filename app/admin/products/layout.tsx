import { requireAdminPermission } from "@/lib/admin-permissions";

export default async function PermissionLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("PRODUCTS:VIEW");
  return children;
}
