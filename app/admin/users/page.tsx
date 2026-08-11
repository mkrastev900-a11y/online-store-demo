/* eslint-disable @next/next/no-html-link-for-pages -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { prisma } from "@/lib/prisma";
import UsersAdminPanel from "@/components/admin/UsersAdminPanel";
import styles from "./users.module.css";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const databaseNow = new Date();
  const users = await prisma.user.findMany({
    where: {
      ...(q ? { OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { city: { contains: q } },
      ] } : {}),
      ...(status === "verified" ? { emailVerifiedAt: { not: null } } : {}),
      ...(status === "pending" ? { emailVerifiedAt: null, authProvider: "credentials" } : {}),
      ...(status === "google" ? { authProvider: "google" } : {}),
    },
    select: {
      id: true, name: true, email: true, phone: true, address: true, addressLine2: true,
      city: true, postalCode: true, country: true, role: true, isActive: true,
      authProvider: true, emailVerifiedAt: true, termsAcceptedAt: true, termsVersion: true,
      createdAt: true, lastLoginAt: true,
      emailVerificationCodes: {
        where: { usedAt: null }, orderBy: { createdAt: "desc" }, take: 1,
        select: { id: true, codePlain: true, expiresAt: true, attempts: true, createdAt: true },
      },
      _count: { select: { orders: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    verificationCode: user.emailVerificationCodes[0] ? {
      ...user.emailVerificationCodes[0],
      expiresAt: user.emailVerificationCodes[0].expiresAt.toISOString(),
      createdAt: user.emailVerificationCodes[0].createdAt.toISOString(),
      expired: user.emailVerificationCodes[0].expiresAt.getTime() <= databaseNow.getTime(),
    } : null,
  }));

  return <main className={styles.main}>
    <div className={styles.title}><span>АКАУНТИ И ПОТВЪРЖДЕНИЕ</span><h1>Потребители</h1><p>Преглед на профили, тестови кодове, лични данни и ръчно потвърждаване.</p></div>
    <form className={styles.filters}>
      <input name="q" defaultValue={q} placeholder="Име, имейл, телефон или град" />
      <select name="status" defaultValue={status}><option value="all">Всички</option><option value="pending">Чакащи потвърждение</option><option value="verified">Потвърдени</option><option value="google">Google профили</option></select>
      <button type="submit">Филтрирай</button><a href="/admin/users">Изчисти</a>
    </form>
    <UsersAdminPanel initialUsers={rows} />
  </main>;
}
