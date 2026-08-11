import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailCode } from "@/lib/email-verification";
import { checkRateLimit, getClientIp, isSameOriginRequest, rateLimitHeaders } from "@/lib/request-security";
import { createTermsToken } from "@/lib/terms";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалидна заявка." }, { status: 403 });
  const limit = await checkRateLimit(`verify-email:${getClientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Твърде много опити. Поискай нов код по-късно." }, { status: 429, headers: rateLimitHeaders(limit) });
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").replace(/\D/g, "").slice(0, 6);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true, authProvider: true, termsAcceptedAt: true, termsAcceptanceRequired: true } });
  if (!user || user.authProvider !== "credentials") return NextResponse.json({ error: "Невалиден код или имейл." }, { status: 400 });
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true, needsTerms: user.termsAcceptanceRequired && !user.termsAcceptedAt, termsToken: user.termsAcceptanceRequired && !user.termsAcceptedAt ? createTermsToken(user.id) : undefined });
  if (code.length !== 6 || !(await verifyEmailCode(user.id, code))) return NextResponse.json({ error: "Кодът е грешен, изтекъл или е използван." }, { status: 400 });
  return NextResponse.json({ verified: true, needsTerms: true, termsToken: createTermsToken(user.id) });
}
