import { requireAdminPermission } from "@/lib/admin-permissions";

export default async function EditProductLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("PRODUCTS:EDIT");
  return children;
}
