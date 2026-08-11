import SizeGuideManager from "@/components/admin/SizeGuideManager";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";
export const dynamic = "force-dynamic";
export default async function SizesPage(){await requireAdminPermission("PRODUCTS:VIEW");return <main className={styles.main}><div className={styles.titleRow}><div><span>МАГАЗИН</span><h1>Размери и размерни таблици</h1><p>Само европейски размери. Създай стандарт веднъж и го използвай при много артикули.</p></div></div><SizeGuideManager/></main>}
