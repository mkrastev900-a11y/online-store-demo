import type { AdminHelpAccess, AdminHelpSection } from "./types";

function hasPermission(permission: string | undefined, access: AdminHelpAccess) {
  if (!permission) return true;
  if (access.isSuperAdmin) return true;
  return Boolean(access.permissions?.includes(permission));
}

export function canSeeAdminHelpSection(section: AdminHelpSection, access: AdminHelpAccess) {
  const hasDesignAccess = Boolean(
    access.isSuperAdmin ||
    access.isDesignOwner ||
    access.permissions?.includes("WEB_DESIGN:VIEW"),
  );
  if (section.designOwnerOnly && !hasDesignAccess) return false;
  if (section.superAdminOnly && !access.isSuperAdmin) return false;
  return hasPermission(section.permission, access);
}

export function getVisibleAdminHelpSections(
  sections: readonly AdminHelpSection[],
  access: AdminHelpAccess,
) {
  return sections
    .filter((section) => canSeeAdminHelpSection(section, access))
    .map((section) => ({
      ...section,
      controls: section.controls.filter((item) => {
        if (item.superAdminOnly && !access.isSuperAdmin) return false;
        return hasPermission(item.permission, access);
      }),
      workflows: section.workflows.filter((item) => {
        if (item.superAdminOnly && !access.isSuperAdmin) return false;
        return hasPermission(item.permission, access);
      }),
    }));
}
