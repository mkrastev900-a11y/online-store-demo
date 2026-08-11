import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const customerOrderSelect = {
  id: true,
  status: true,
  total: true,
  shippingCost: true,
  promoCode: true,
  promoDiscount: true,
  deliveryMethod: true,
  paymentMethod: true,
  paymentStatus: true,
  courierProvider: true,
  courierOfficeName: true,
  courierOfficeAddress: true,
  address: true,
  city: true,
  postalCode: true,
  shipmentNumber: true,
  shipmentStatus: true,
  shipmentCreatedAt: true,
  shipmentLastTrackedAt: true,
  createdAt: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    select: {
      id: true,
      name: true,
      size: true,
      price: true,
      quantity: true,
      product: { select: { slug: true, imageUrl: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.OrderSelect;

type CustomerOrderRecord = Prisma.OrderGetPayload<{ select: typeof customerOrderSelect }>;
export type CustomerOrder = Omit<CustomerOrderRecord, "total" | "shippingCost" | "promoDiscount" | "items"> & {
  total: number;
  shippingCost: number;
  promoDiscount: number;
  items: Array<Omit<CustomerOrderRecord["items"][number], "price"> & { price: number }>;
};

const contactOrderOptionSelect = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      name: true,
      size: true,
      quantity: true,
      price: true,
      product: { select: { imageUrl: true, color: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.OrderSelect;

type ContactOrderOptionRecord = Prisma.OrderGetPayload<{
  select: typeof contactOrderOptionSelect;
}>;
export type ContactOrderOption = Omit<ContactOrderOptionRecord, "total" | "items"> & {
  total: number;
  items: Array<Omit<ContactOrderOptionRecord["items"][number], "price"> & { price: number }>;
};

export async function listCustomerOrders(userId: number): Promise<CustomerOrder[]> {
  if (!Number.isInteger(userId) || userId <= 0) return [];

  const orders = await prisma.order.findMany({
    where: { userId },
    select: customerOrderSelect,
    orderBy: { createdAt: "desc" },
  });
  return orders.map((order) => ({
    ...order,
    total: Number(order.total),
    shippingCost: Number(order.shippingCost),
    promoDiscount: Number(order.promoDiscount),
    items: order.items.map((item) => ({ ...item, price: Number(item.price) })),
  }));
}

export async function listContactOrderOptions(
  userId: number,
): Promise<ContactOrderOption[]> {
  if (!Number.isInteger(userId) || userId <= 0) return [];

  const orders = await prisma.order.findMany({
    where: { userId },
    select: contactOrderOptionSelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return orders.map((order) => ({ ...order, total: Number(order.total), items: order.items.map((item) => ({ ...item, price: Number(item.price) })) }));
}

export async function customerOwnsOrder(userId: number, orderId: number) {
  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(orderId) ||
    orderId <= 0
  ) {
    return false;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });

  return Boolean(order);
}
