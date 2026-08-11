import { getAdminTrainingRoute } from "./routes";
import {
  CATALOG_HELP_SECTIONS,
  COMMON_HELP_SECTIONS,
  DESIGN_MARKETING_HELP_SECTIONS,
  OPERATIONS_HELP_SECTIONS,
  PEOPLE_SYSTEM_HELP_SECTIONS,
} from "./sections";

export * from "./access";
export * from "./glossary";
export * from "./routes";
export * from "./search";
export type * from "./types";

export const ADMIN_HELP_SECTIONS = [
  ...COMMON_HELP_SECTIONS,
  ...CATALOG_HELP_SECTIONS,
  ...OPERATIONS_HELP_SECTIONS,
  ...PEOPLE_SYSTEM_HELP_SECTIONS,
  ...DESIGN_MARKETING_HELP_SECTIONS,
];

export function getAdminHelpSectionForPath(pathname: string) {
  const mapped = getAdminTrainingRoute(pathname);
  if (mapped) return ADMIN_HELP_SECTIONS.find((section) => section.id === mapped.topicId);

  const normalized = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return ADMIN_HELP_SECTIONS
    .flatMap((section) => section.hrefs.map((href) => ({ section, href: href.replace(/\/$/, "") })))
    .filter(({ href }) => !href.includes(":") && (normalized === href || normalized.startsWith(`${href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.section;
}
