import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { findUserByEmail, recordSuccessfulLogin } from "@/lib/auth-db";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/request-security";
import { createTermsToken, CURRENT_TERMS_VERSION } from "@/lib/terms";
import { resolveLoginIdentifier } from "@/lib/demo-mode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(`login:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Твърде много опити за вход. Опитай отново след малко." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    const isNativeForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
    const body = isNativeForm
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json();
    const email = resolveLoginIdentifier(String(body.email ?? ""));
    const password = String(body.password ?? "");

    const user = await findUserByEmail(email);

    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Грешен имейл, потребителско име или парола." },
        { status: 401 },
      );
    }

    if (user.authProvider === "credentials" && !user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Потвърди имейла си, преди да влезеш.", needsVerification: true, email: user.email },
        { status: 403 },
      );
    }

    if (!user.termsAcceptedAt || user.termsVersion !== CURRENT_TERMS_VERSION || user.termsAcceptanceRequired) {
      return NextResponse.json(
        { error: "Приеми Общите условия, за да активираш профила си.", needsTerms: true, termsToken: createTermsToken(user.id) },
        { status: 403 },
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    try {
      await recordSuccessfulLogin(user.id);
    } catch (error) {
      // Login must not fail only because the secondary lastLoginAt audit write failed.
      console.error("Login lastLoginAt update failed:", error);
    }

    const destination = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/" : "/account";
    const response = isNativeForm
      ? NextResponse.redirect(new URL(destination, request.url), { status: 303 })
      : NextResponse.json({
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });

    response.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });

    for (const [key, value] of Object.entries(rateLimitHeaders(rateLimit))) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    console.error("Login request failed:", error);
    return NextResponse.json(
      { error: "Входът не беше завършен." },
      { status: 500 },
    );
  }
}
