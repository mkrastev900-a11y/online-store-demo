import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp, isSameOriginRequest, rateLimitHeaders } from "@/lib/request-security";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
const GENERIC_MESSAGE = "Ако този имейл е регистриран, изпратихме инструкции за възстановяване на паролата.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалидна заявка." }, { status: 403 });
  const limit = await checkRateLimit(`forgot-password:${getClientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: rateLimitHeaders(limit) });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true, authProvider: true } });
      if (user?.isActive && user.authProvider === "credentials") {
        const { token, expiresAt } = await createPasswordResetToken(user.id);
        const origin = getPublicSiteUrl(request.url);
        const delivery = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl: `${origin}/reset-password/${token}`, expiresAt });
        if (!delivery.sent) {
          console.error("Password reset email was not accepted by Resend:", delivery.reason);
        }
        const response = NextResponse.json({
          message: delivery.sent
            ? delivery.testRedirected
              ? `Тестовият имейл е изпратен към ${delivery.actualRecipient}. Линкът е за профила ${user.email}.`
              : GENERIC_MESSAGE
            : process.env.RESEND_TEST_MODE === "true"
              ? "Resend не прие имейла. Провери RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO и тестовия получател."
              : GENERIC_MESSAGE,
          delivery: delivery.sent ? (delivery.testRedirected ? "test-redirected" : "sent") : "failed",
        });
        for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
        return response;
      }
    }
  } catch (error) {
    console.error("Forgot password request failed:", error);
  }
  const response = NextResponse.json({ message: GENERIC_MESSAGE });
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
  return response;
}
