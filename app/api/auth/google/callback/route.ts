import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { exchangeGoogleCode, fetchGoogleProfile, findOrCreateGoogleUser, parseOAuthState } from "@/lib/google-auth";
import { createTermsToken, CURRENT_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";

const stateCookie = "zlatevi_google_oauth_state";

function errorRedirect(requestUrl: string, target: string, code: string) {
  const url = new URL(target, requestUrl);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = parseOAuthState(url.searchParams.get("state"));
  const cookieNonce = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${stateCookie}=`))?.split("=")[1];
  const next = state?.next ?? "/account";
  const errorPath = state?.source === "register" ? "/register" : "/login";

  if (!code || !state || !cookieNonce || decodeURIComponent(cookieNonce) !== state.nonce) {
    return errorRedirect(request.url, errorPath, "google_state");
  }

  try {
    const accessToken = await exchangeGoogleCode({ code, requestUrl: request.url });
    const profile = await fetchGoogleProfile(accessToken);
    if (!profile.email_verified) return errorRedirect(request.url, errorPath, "google_unverified");
    const user = await findOrCreateGoogleUser(profile);
    if (!user.isActive) return errorRedirect(request.url, errorPath, "inactive");
    const needsTerms = !user.termsAcceptedAt || user.termsVersion !== CURRENT_TERMS_VERSION || user.termsAcceptanceRequired;
    if (needsTerms) {
      const acceptUrl = new URL("/accept-terms", request.url);
      acceptUrl.searchParams.set("token", createTermsToken(user.id));
      acceptUrl.searchParams.set("next", next);
      const response = NextResponse.redirect(acceptUrl);
      response.cookies.set(stateCookie, "", { httpOnly: true, path: "/", maxAge: 0 });
      return response;
    }

    const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
    const response = NextResponse.redirect(new URL(next, request.url));
    response.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    response.cookies.set(stateCookie, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Google auth callback error:", error);
    return errorRedirect(request.url, errorPath, "google_failed");
  }
}
