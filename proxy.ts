import { NextResponse, type NextRequest } from "next/server";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const externalWebhookPaths = new Set(["/api/payments/epay/notify"]);

function normalizeHost(value: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

function isAllowedRequestOrigin(request: NextRequest, origin: string) {
  try {
    const originUrl = new URL(origin);
    const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
    const host = normalizeHost(forwardedHost || request.headers.get("host"));

    // Compare against the actual HTTP Host header first. This avoids false
    // cross-origin rejections when Next.js normalizes 127.0.0.1 to localhost
    // (or the reverse) in request.nextUrl during local development.
    if (host && normalizeHost(originUrl.host) === host) return true;

    if (originUrl.origin === request.nextUrl.origin) return true;

    // localhost and 127.0.0.1 are equivalent loopback hosts for local dev.
    // Keep this relaxation strictly outside production and require same port.
    if (process.env.NODE_ENV !== "production") {
      const requestUrl = request.nextUrl;
      if (
        isLocalHostname(originUrl.hostname) &&
        isLocalHostname(requestUrl.hostname) &&
        originUrl.port === requestUrl.port
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (
    unsafeMethods.has(request.method) &&
    !externalWebhookPaths.has(request.nextUrl.pathname)
  ) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    const crossOrigin = origin ? !isAllowedRequestOrigin(request, origin) : false;

    if (crossOrigin || (!origin && fetchSite === "cross-site")) {
      return NextResponse.json(
        { error: "Невалиден източник на заявката." },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
