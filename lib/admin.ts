import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function getAdminUser() {
  const session = await getSession();

  if (!session) return null;

  return prisma.user.findFirst({
    where: {
      id: session.userId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function getSuperAdminUser() {
  const admin = await getAdminUser();
  return admin?.role === "SUPER_ADMIN" ? admin : null;
}

export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?next=/admin");
  return admin;
}

export async function requireSuperAdmin() {
  const admin = await getSuperAdminUser();
  if (!admin) redirect("/admin");
  return admin;
}

export async function requireAdminApi() {
  return getAdminUser();
}

export async function requireSuperAdminApi() {
  return getSuperAdminUser();
}
