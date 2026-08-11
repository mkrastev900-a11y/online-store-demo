import crypto from "node:crypto";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version.mjs";

export { CURRENT_TERMS_VERSION };
const TOKEN_TTL_SECONDS = 30 * 60;

function secret() {
  return process.env.AUTH_SECRET || process.env.SESSION_SECRET || "development-only-secret-change-me";
}
function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}
export function createTermsToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now()/1000)+TOKEN_TTL_SECONDS, purpose:"terms" })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifyTermsToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {userId?:unknown;exp?:unknown;purpose?:unknown};
    if (parsed.purpose !== "terms" || typeof parsed.userId !== "number" || typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now()/1000)) return null;
    return { userId: parsed.userId };
  } catch { return null; }
}
