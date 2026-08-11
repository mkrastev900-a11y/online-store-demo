import { prisma } from "@/lib/prisma";

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkRateLimit(key: string, options: { limit: number; windowMs: number }) {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1_000, Math.floor(options.windowMs));
  const normalizedKey = key.trim().slice(0, 240);
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);
  try {
    const current = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key: normalizedKey } });
      if (!existing || existing.resetAt <= now) {
        return tx.rateLimitBucket.upsert({
          where: { key: normalizedKey },
          update: { count: 1, resetAt: nextResetAt },
          create: { key: normalizedKey, count: 1, resetAt: nextResetAt },
        });
      }
      return tx.rateLimitBucket.update({ where: { key: normalizedKey }, data: { count: { increment: 1 } } });
    });
    return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt.getTime() };
  } catch (error) {
    console.error("Shared rate limit store failed:", error);
    return { allowed: process.env.NODE_ENV !== "production", remaining: 0, resetAt: nextResetAt.getTime() };
  }
}

export function rateLimitHeaders(result: { remaining: number; resetAt: number }) {
  return { "X-RateLimit-Remaining": String(result.remaining), "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)) };
}

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}
function sameOriginOrLocalLoopback(a: URL, b: URL) {
  if (a.origin === b.origin) return true;
  return a.protocol === b.protocol && a.port === b.port && isLoopbackHost(a.hostname) && isLoopbackHost(b.hostname);
}
export function isSameOriginRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) { try { return sameOriginOrLocalLoopback(new URL(origin), requestUrl); } catch { return false; } }
  const referer = request.headers.get("referer");
  if (referer) { try { return sameOriginOrLocalLoopback(new URL(referer), requestUrl); } catch { return false; } }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  return process.env.NODE_ENV !== "production";
}
