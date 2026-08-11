import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationCode } from "@/lib/email-verification";
import { sendEmailVerificationCode } from "@/lib/email";
import { checkRateLimit, getClientIp, isSameOriginRequest, rateLimitHeaders } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалидна заявка." }, { status: 403 });
  const limit = await checkRateLimit(`resend-verification:${getClientIp(request)}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Достигна лимита за нов код. Опитай по-късно." }, { status: 429, headers: rateLimitHeaders(limit) });
  const email = String((await request.json()).email ?? "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, emailVerifiedAt: true, authProvider: true, isActive: true } });
  if (user?.isActive && user.authProvider === "credentials" && !user.emailVerifiedAt) {
    const { code, expiresAt } = await createEmailVerificationCode(user.id);
    const delivery = await sendEmailVerificationCode({ to: user.email, name: user.name, code, expiresAt });
    if (!delivery.sent) return NextResponse.json({ error: "Кодът не беше изпратен. Провери имейл настройките." }, { status: 502 });
    return NextResponse.json({ sent: true, testRecipient: delivery.testRedirected ? delivery.actualRecipient : undefined });
  }
  return NextResponse.json({ sent: true });
}
