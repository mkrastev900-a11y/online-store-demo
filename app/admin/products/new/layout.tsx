import { requireAdminPermission } from "@/lib/admin-permissions";

export default async function NewProductPermissionLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("PRODUCTS:CREATE");
  return children;
}
