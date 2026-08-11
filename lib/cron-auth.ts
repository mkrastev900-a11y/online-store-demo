import { timingSafeEqual } from "node:crypto";

type CronEnvironment = Record<string, string | undefined>;

export function hasValidCronSecret(request: Request, env: CronEnvironment = process.env) {
  const secret = String(env.CRON_SECRET || "");
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
