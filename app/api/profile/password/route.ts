import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const currentPassword = body.currentPassword || "";
    const newPassword = body.newPassword || "";
    const confirmPassword = body.confirmPassword || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Попълни всички полета за парола." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Новата парола трябва да е поне 8 знака." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Новата парола и потвърждението не съвпадат." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true, authProvider: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Профилът не е намерен." }, { status: 404 });
    }
    if (user.authProvider !== "credentials") {
      return NextResponse.json(
        { error: "Този профил използва вход с Google. Паролата се управлява от Google." },
        { status: 400 },
      );
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Текущата парола е грешна." }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Новата парола трябва да е различна от текущата." }, { status: 400 });
    }

    const changed = await prisma.user.updateMany({
      where: { id: session.userId, passwordHash: user.passwordHash, authProvider: "credentials" },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    if (changed.count !== 1) {
      return NextResponse.json({ error: "Текущата парола е грешна." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Паролата е сменена успешно." });
  } catch {
    return NextResponse.json({ error: "Паролата не можа да бъде сменена." }, { status: 500 });
  }
}
