import { requireAdminPermission } from "@/lib/admin-permissions";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("CUSTOMERS:VIEW");
  return children;
}
