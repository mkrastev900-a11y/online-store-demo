import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";
import { checkRateLimit, getClientIp, isSameOriginRequest, rateLimitHeaders } from "@/lib/request-security";

export const runtime = "nodejs";
function validPassword(value: string) { return value.length >= 8 && /[a-zа-я]/i.test(value) && /\d/.test(value); }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Невалидна заявка." }, { status: 403 });
  const limit = await checkRateLimit(`reset-password:${getClientIp(request)}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Твърде много опити. Опитай по-късно." }, { status: 429, headers: rateLimitHeaders(limit) });
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    if (!token || !password || !confirmPassword) return NextResponse.json({ error: "Попълни всички полета." }, { status: 400 });
    if (!validPassword(password)) return NextResponse.json({ error: "Паролата трябва да е поне 8 знака и да съдържа буква и цифра." }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ error: "Паролите не съвпадат." }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    const reset = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(token) },
        include: { user: { select: { id: true, isActive: true, authProvider: true } } },
      });
      if (!record || record.usedAt || record.expiresAt <= now || !record.user.isActive || record.user.authProvider !== "credentials") {
        return false;
      }
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, userId: record.userId, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });
    if (!reset) {
      return NextResponse.json({ error: "Линкът е невалиден или е изтекъл." }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Паролата е сменена успешно." });
  } catch (error) {
    console.error("Reset password failed:", error);
    return NextResponse.json({ error: "Паролата не можа да бъде сменена." }, { status: 500 });
  }
}
