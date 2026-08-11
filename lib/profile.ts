import { prisma } from "@/lib/prisma";

export type ProfileInput = {
  name: string;
  phone: string;
  address: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
};

export async function getProfile(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
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
    },
  });
}

export async function updateProfile(userId: number, input: ProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city.trim() || null,
      postalCode: input.postalCode.trim() || null,
      country: input.country.trim() || "Bulgaria",
    },
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
    },
  });
}
