const LOCAL_SITE_URL = "http://localhost:3000";

function normalizedUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function getPublicSiteUrl(requestUrl?: string) {
  const configured =
    normalizedUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizedUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizedUrl(process.env.APP_URL);

  if (configured) return configured;
  if (requestUrl) return normalizedUrl(new URL(requestUrl).origin) || LOCAL_SITE_URL;
  return LOCAL_SITE_URL;
}

