import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const orderId = Number(q.replace(/^#/, ""));
  const [canViewProducts, canViewCustomers, canViewOrders] = await Promise.all([
    hasAdminPermission(admin.id, admin.role, "PRODUCTS:VIEW"),
    hasAdminPermission(admin.id, admin.role, "CUSTOMERS:VIEW"),
    hasAdminPermission(admin.id, admin.role, "ORDERS:VIEW"),
  ]);
  const [products, users, orders] = await Promise.all([
    canViewProducts ? prisma.product.findMany({ where: { OR: [{ name: { contains: q } }, { sku: { contains: q } }] }, take: 5, select: { id: true, name: true, sku: true } }) : [],
    canViewCustomers ? prisma.user.findMany({ where: { role: "CUSTOMER", OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }, take: 5, select: { id: true, name: true, email: true } }) : [],
    canViewOrders ? prisma.order.findMany({ where: { OR: [...(Number.isFinite(orderId) ? [{ id: orderId }] : []), { customerName: { contains: q } }, { customerEmail: { contains: q } }] }, take: 5, select: { id: true, customerName: true, total: true } }) : [],
  ]);
  return NextResponse.json({ results: [
    ...products.map((p) => ({ type: "product", id: p.id, title: p.name, subtitle: p.sku || "Без SKU", href: `/admin/products/${p.id}/edit` })),
    ...users.map((u) => ({ type: "customer", id: u.id, title: u.name, subtitle: u.email, href: `/admin/customers/${u.id}` })),
    ...orders.map((o) => ({ type: "order", id: o.id, title: `Поръчка #${o.id} · ${o.customerName}`, subtitle: `${Number(o.total).toFixed(2)} €`, href: "/admin/orders" })),
  ] });
}
