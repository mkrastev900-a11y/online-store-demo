import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/auth-db";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/request-security";
import { isValidPhoneCharacters } from "@/lib/numeric-fields";
import { createEmailVerificationCode } from "@/lib/email-verification";
import { sendEmailVerificationCode } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(`register:${getClientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Твърде много регистрации от този адрес. Опитай по-късно." }, { status: 429, headers: rateLimitHeaders(rateLimit) });

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim() || null;
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Името трябва да бъде между 2 и 100 символа." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Въведи валиден имейл адрес." }, { status: 400 });
    if (!isValidPhoneCharacters(phone ?? "")) return NextResponse.json({ error: "Телефонът може да съдържа само цифри и една начална +." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Паролата трябва да съдържа поне 8 символа." }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ error: "Двете пароли не съвпадат." }, { status: 400 });

    const existing = await findUserByEmail(email);
    if (existing) {
      if (existing.authProvider === "credentials" && !existing.emailVerifiedAt) {
        return NextResponse.json({ error: "Профилът вече е създаден, но не е потвърден.", needsVerification: true, email }, { status: 409 });
      }
      return NextResponse.json({ error: "Вече има регистрация с този имейл." }, { status: 409 });
    }

    const user = await createUser({ name, email, phone, passwordHash: await bcrypt.hash(password, 12) });
    const { code, expiresAt } = await createEmailVerificationCode(user.id);
    const delivery = await sendEmailVerificationCode({ to: user.email, name: user.name, code, expiresAt });
    if (!delivery.sent) {
      await import("@/lib/prisma").then(({ prisma }) => prisma.user.delete({ where: { id: user.id } })).catch(() => undefined);
      return NextResponse.json({ error: "Не успяхме да изпратим кода за потвърждение. Опитай отново." }, { status: 502 });
    }
    const response = NextResponse.json({ needsVerification: true, email, testRecipient: delivery.testRedirected ? delivery.actualRecipient : undefined }, { status: 201 });
    for (const [key, value] of Object.entries(rateLimitHeaders(rateLimit))) response.headers.set(key, value);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Вече има регистрация с този имейл." }, { status: 409 });
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "Регистрацията не беше завършена." }, { status: 500 });
  }
}
