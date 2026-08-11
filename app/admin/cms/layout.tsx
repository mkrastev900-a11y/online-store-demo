import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/admin-permissions";

export default async function CmsLayout({ children }: { children: ReactNode }) {
  await requireAdminPermission("WEB_DESIGN:VIEW");
  return children;
}
