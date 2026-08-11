import { NextResponse } from "next/server";
import { createOAuthState, googleClientConfig, parseOAuthState } from "@/lib/google-auth";

export const runtime = "nodejs";

const stateCookie = "zlatevi_google_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") === "register" ? "register" : "login";

  try {
    const next = url.searchParams.get("next") || "/account";
    const state = createOAuthState(next, source);
    const parsed = parseOAuthState(state);
    if (!parsed) throw new Error("INVALID_STATE");

    const config = googleClientConfig(request.url);
    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", config.clientId);
    googleUrl.searchParams.set("redirect_uri", config.redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", state);
    googleUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(googleUrl);
    response.cookies.set(stateCookie, parsed.nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL(`/${source}?error=google_config`, request.url));
  }
}
