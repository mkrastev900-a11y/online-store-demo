import PromoCodesManager from "@/components/admin/PromoCodesManager";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  await requireAdminPermission("PRODUCTS:VIEW");
  const rows = await prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  const promoCodes = rows.map((item) => ({
    ...item,
    regularDiscountPercent: Number(item.regularDiscountPercent),
    saleDiscountPercent: Number(item.saleDiscountPercent),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
  return <main className={styles.main}>
    <div className={styles.titleRow}><div><span>МАГАЗИН</span><h1>Промокодове</h1><p>Създавай кодове с отделна отстъпка за стоки на редовна цена и за артикули, които вече са намалени.</p></div></div>
    <PromoCodesManager initialPromoCodes={promoCodes} />
  </main>;
}
