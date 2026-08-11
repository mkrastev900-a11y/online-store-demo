export const AUTH_UPDATED_EVENT = "zlatevi:auth-updated";

export type HeaderAuthUser = {
  id: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
};

export type AuthUpdatedDetail = {
  user?: HeaderAuthUser | null;
};

export function emitAuthUpdated(detail: AuthUpdatedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthUpdatedDetail>(AUTH_UPDATED_EVENT, { detail }));
}
