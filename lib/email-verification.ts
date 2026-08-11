import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 15 * 60 * 1000;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function createEmailVerificationCode(userId: number) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await prisma.$transaction([
    prisma.emailVerificationCode.deleteMany({ where: { userId, usedAt: null } }),
    prisma.emailVerificationCode.create({ data: { userId, codeHash: hashCode(code), codePlain: code, expiresAt } }),
  ]);
  return { code, expiresAt };
}

export async function verifyEmailCode(userId: number, rawCode: string) {
  const record = await prisma.emailVerificationCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= 5) return false;
  const candidate = hashCode(rawCode.trim());
  const valid = crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(record.codeHash));
  if (!valid) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await prisma.$transaction([
    prisma.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return true;
}
