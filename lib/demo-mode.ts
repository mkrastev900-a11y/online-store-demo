export const DEFAULT_DEMO_DATA_TTL_MINUTES = 30;

type DemoEnvironment = Record<string, string | undefined>;

export function isDemoModeEnabled(env: DemoEnvironment = process.env) {
  return env.DEMO_MODE === "true";
}

export function getDemoDataTtlMinutes(env: DemoEnvironment = process.env) {
  const parsed = Number(env.DEMO_DATA_TTL_MINUTES);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24 * 60) {
    return DEFAULT_DEMO_DATA_TTL_MINUTES;
  }
  return parsed;
}

export function resolveLoginIdentifier(identifier: string, env: DemoEnvironment = process.env) {
  const normalized = identifier.trim().toLowerCase();

  const explicitSetting = env.CREATE_TEST_ADMIN;
  const localDevelopmentDefault = explicitSetting === undefined && env.NODE_ENV !== "production";
  if (explicitSetting !== "true" && !localDevelopmentDefault) return normalized;

  const username = String(env.TEST_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const email = String(env.TEST_ADMIN_EMAIL || "admin@example.local").trim().toLowerCase();
  return username && email && normalized === username ? email : normalized;
}

export function getProtectedTestAdminEmail(env: DemoEnvironment = process.env) {
  if (env.CREATE_TEST_ADMIN !== "true") return null;
  const email = String(env.TEST_ADMIN_EMAIL || "").trim().toLowerCase();
  return email || null;
}
