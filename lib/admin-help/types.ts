export type AdminHelpControlKind =
  | "button"
  | "field"
  | "select"
  | "checkbox"
  | "radio"
  | "filter"
  | "status"
  | "table"
  | "link"
  | "navigation"
  | "modal"
  | "display";

export type AdminHelpControl = {
  id: string;
  name: string;
  kind: AdminHelpControlKind;
  purpose: string;
  when: string;
  how: string[];
  format?: string;
  example?: string;
  after: string;
  customerImpact: string;
  success: string;
  errors: string[];
  avoid: string[];
  permission?: string;
  superAdminOnly?: boolean;
};

export type AdminHelpStatus = {
  name: string;
  meaning: string;
  next: string;
  warning?: string;
};

export type AdminHelpWorkflow = {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  result: string;
  warning?: string;
  permission?: string;
  superAdminOnly?: boolean;
};

export type AdminHelpError = {
  message: string;
  meaning: string;
  action: string;
};

export type AdminHelpSection = {
  id: string;
  title: string;
  shortTitle: string;
  hrefs: string[];
  permission?: string;
  superAdminOnly?: boolean;
  designOwnerOnly?: boolean;
  summary: string;
  purpose: string;
  beginner: string;
  whenToUse: string[];
  whenNotToUse: string[];
  screen: string[];
  controls: AdminHelpControl[];
  statuses: AdminHelpStatus[];
  workflows: AdminHelpWorkflow[];
  errors: AdminHelpError[];
  mistakes: string[];
  checklist: string[];
  tips: string[];
  keywords: string[];
};

export type AdminGlossaryEntry = {
  term: string;
  fullName: string;
  bulgarian: string;
  meaning: string;
  inStore: string;
  example: string;
  aliases?: string[];
};

export type AdminHelpAccess = {
  isSuperAdmin: boolean;
  permissions?: readonly string[];
  isDesignOwner?: boolean;
};

export type AdminTrainingRoute = {
  id: string;
  route: string;
  name: string;
  purpose: string;
  audience: string;
  permission?: string;
  designOwnerOnly?: boolean;
  topicId: string;
  controlsFound: string[];
  relatedRoutes: string[];
  redirectTo?: string;
};

export type AdminHelpSearchResult = {
  topicId: string;
  title: string;
  context: string;
  score: number;
};
