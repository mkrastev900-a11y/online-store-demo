import { prisma } from "@/lib/prisma";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function findPublicUserById(userId: number) {
  return prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      addressLine2: true,
      city: true,
      postalCode: true,
      country: true,
      authProvider: true,
      role: true,
      createdAt: true,
      termsAcceptedAt: true,
      termsVersion: true,
    },
  });
}

export async function recordSuccessfulLogin(userId: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    select: { id: true },
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: input.passwordHash,
      cart: { create: {} },
    },
  });
}
