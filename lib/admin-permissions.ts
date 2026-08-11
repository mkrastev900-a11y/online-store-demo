import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";

export { ADMIN_SECTIONS, ACTION_LABELS, DEFAULT_ADMIN_PERMISSIONS, isValidPermission } from "@/lib/admin-permission-catalog";
import { isValidPermission } from "@/lib/admin-permission-catalog";
import type { AdminPermissionKey } from "@/lib/admin-permission-catalog";

export async function getPermissionKeys(userId: number): Promise<AdminPermissionKey[]> {
  const rows = await prisma.adminPermission.findMany({ where: { userId, allowed: true }, select: { section: true, action: true } });
  return rows.map((row) => `${row.section}:${row.action}` as AdminPermissionKey);
}

export async function hasAdminPermission(userId: number, role: string, permission: AdminPermissionKey) {
  if (role === "SUPER_ADMIN") return true;
  const [section, action] = permission.split(":");
  return Boolean(await prisma.adminPermission.findUnique({ where: { userId_section_action: { userId, section, action } }, select: { allowed: true } }).then((r) => r?.allowed));
}

export async function requireAdminPermission(permission: AdminPermissionKey) {
  const admin = await getAdminUser();
  if (!admin) redirect(`/login?next=/admin`);
  if (!(await hasAdminPermission(admin.id, admin.role, permission))) redirect("/admin/access-denied");
  return admin;
}

export async function requireAdminPermissionApi(permission: AdminPermissionKey) {
  const admin = await getAdminUser();
  if (!admin) return null;
  return (await hasAdminPermission(admin.id, admin.role, permission)) ? admin : null;
}

export async function requireAnyAdminPermissionApi(permissions: readonly AdminPermissionKey[]) {
  const admin = await getAdminUser();
  if (!admin) return null;
  if (admin.role === "SUPER_ADMIN") return admin;
  const checks = await Promise.all(
    permissions.map((permission) => hasAdminPermission(admin.id, admin.role, permission)),
  );
  return checks.some(Boolean) ? admin : null;
}

export async function replaceAdminPermissions(userId: number, keys: string[], actorId: number) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!target || target.role !== "ADMIN") throw new Error("Права могат да се задават само на подадминистратор.");

  const normalized = [...new Set(keys)].map((key) => {
    const [section, action] = key.split(":");
    if (!isValidPermission(section, action)) throw new Error(`Невалидно право: ${key}`);
    return { userId, section, action, allowed: true };
  });

  await prisma.$transaction(async (tx) => {
    await tx.adminPermission.deleteMany({ where: { userId } });
    if (normalized.length) await tx.adminPermission.createMany({ data: normalized });
  });

  const { writeAuditLog } = await import("@/lib/audit");
  await writeAuditLog({
    actorId, action: "ADMIN_PERMISSIONS_UPDATED", entityType: "User", entityId: userId,
    description: `Правата на подадминистратора ${target.name || target.email} са обновени.`,
    metadata: { targetEmail: target.email, permissions: normalized.map((p) => `${p.section}:${p.action}`) },
  });
}
