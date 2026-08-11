import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: number) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
  ]);

  return { token, expiresAt };
}
