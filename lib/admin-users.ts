import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function listUsersForRoleManagement() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      createdByAdmin: { select: { name: true, email: true } },
      adminPermissions: { where: { allowed: true }, select: { section: true, action: true } },
    },
    orderBy: [{ role: "desc" }, { name: "asc" }, { createdAt: "asc" }],
  });

  return users.map((user) => ({
    ...user,
    role: user.role as "CUSTOMER" | "ADMIN" | "SUPER_ADMIN",
    isFixedSuperAdmin: false,
    permissions: user.adminPermissions.map((permission) => `${permission.section}:${permission.action}`),
  }));
}

export async function promoteExistingUserToAdmin(userId: number, grantedByAdminId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user) throw new Error("Потребителят не е намерен.");
  if (user.role === "SUPER_ADMIN") throw new Error("Потребителят вече е главен администратор.");
  if (user.role === "ADMIN") throw new Error("Потребителят вече е администратор.");

  const { DEFAULT_ADMIN_PERMISSIONS } = await import("@/lib/admin-permission-catalog");
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.update({
      where: { id: userId },
      data: {
        role: "ADMIN",
        isActive: true,
        createdByAdminId: grantedByAdminId,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    await Promise.all(
      DEFAULT_ADMIN_PERMISSIONS.map((key) => {
        const [section, action] = key.split(":");
        return tx.adminPermission.upsert({
          where: { userId_section_action: { userId, section, action } },
          update: { allowed: true },
          create: { userId, section, action, allowed: true },
        });
      }),
    );
    return changed;
  });

  await writeAuditLog({
    actorId: grantedByAdminId,
    action: "ADMIN_ROLE_GRANTED",
    entityType: "User",
    entityId: user.id,
    description: `На ${user.name || user.email} са дадени права на подадминистратор.`,
    metadata: { previousRole: user.role, newRole: "ADMIN", targetEmail: user.email },
  });

  return updated;
}

export async function promoteAdministratorToSuperAdmin(id: number, actorId: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) throw new Error("Администраторът не е намерен.");
  if (user.role !== "ADMIN") {
    throw new Error(user.role === "SUPER_ADMIN" ? "Този акаунт вече е главен администратор." : "Само подадминистратор може да бъде повишен.");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: "SUPER_ADMIN", isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await writeAuditLog({
    actorId,
    action: "SUPER_ADMIN_PROMOTED",
    entityType: "User",
    entityId: user.id,
    description: `${user.name || user.email} е повишен от подадминистратор в главен администратор.`,
    metadata: { previousRole: "ADMIN", newRole: "SUPER_ADMIN", targetEmail: user.email },
  });

  return updated;
}

export async function demoteSuperAdminToAdministrator(id: number, actorId: number) {
  const { user, updated } = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!target) throw new Error("Главният администратор не е намерен.");
    if (target.id === actorId) throw new Error("Не можеш да понижиш собствения си акаунт.");
    if (target.role !== "SUPER_ADMIN") throw new Error("Този акаунт не е главен администратор.");
    const superAdminCount = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (superAdminCount <= 1) throw new Error("Последният активен главен администратор не може да бъде понижен.");

    const changed = await tx.user.update({
      where: { id },
      data: { role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return { user: target, updated: changed };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await writeAuditLog({
    actorId,
    action: "SUPER_ADMIN_DEMOTED",
    entityType: "User",
    entityId: user.id,
    description: `${user.name || user.email} е понижен от главен администратор в подадминистратор.`,
    metadata: { previousRole: "SUPER_ADMIN", newRole: "ADMIN", targetEmail: user.email },
  });

  return updated;
}

export async function demoteAdministratorToCustomer(id: number, actorId: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) throw new Error("Администраторът не е намерен.");
  if (user.role !== "ADMIN") throw new Error("Само подадминистратор може да бъде върнат към клиентски акаунт.");

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { role: "CUSTOMER", createdByAdminId: null } }),
    prisma.adminPermission.deleteMany({ where: { userId: id } }),
    prisma.supportTicket.updateMany({ where: { assignedAdminId: id }, data: { assignedAdminId: null } }),
  ]);

  await writeAuditLog({
    actorId,
    action: "ADMIN_ROLE_REMOVED",
    entityType: "User",
    entityId: user.id,
    description: `Администраторските права на ${user.name || user.email} са премахнати.`,
    metadata: { previousRole: "ADMIN", newRole: "CUSTOMER", targetEmail: user.email },
  });
}

export async function deleteAdministratorAccount(id: number, actorId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!target) throw new Error("Администраторът не е намерен.");
    if (target.id === actorId) throw new Error("Не можеш да изтриеш собствения си акаунт, докато си влязъл с него.");
    if (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN") throw new Error("Този акаунт не е администратор.");

    if (target.role === "SUPER_ADMIN") {
      const superAdminCount = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
      if (superAdminCount <= 1) throw new Error("Последният активен главен администратор не може да бъде изтрит.");
    }

    await tx.adminPermission.deleteMany({ where: { userId: id } });
    await tx.supportTicket.updateMany({ where: { assignedAdminId: id }, data: { assignedAdminId: null } });
    await tx.user.updateMany({ where: { createdByAdminId: id }, data: { createdByAdminId: null } });

    const deletedEmail = `deleted-admin-${id}-${Date.now()}@deleted.local`;
    const updated = await tx.user.update({
      where: { id },
      data: {
        name: "Изтрит администратор",
        email: deletedEmail,
        phone: null,
        address: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        country: null,
        adminNote: null,
        googleId: null,
        role: "CUSTOMER",
        isActive: false,
        createdByAdminId: null,
        passwordHash: `deleted-${crypto.randomUUID()}`,
      },
      select: { id: true },
    });

    return { target, updated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await writeAuditLog({
    actorId,
    action: "ADMIN_ACCOUNT_DELETED",
    entityType: "User",
    entityId: result.target.id,
    description: `Администраторският акаунт ${result.target.name || result.target.email} е изтрит и деактивиран.`,
    metadata: { previousRole: result.target.role, targetEmail: result.target.email },
  });

  return result.updated;
}
