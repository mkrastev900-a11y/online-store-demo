import MarketingIntegrationsManager from "@/components/admin/MarketingIntegrationsManager";
import { readMarketingIntegrations } from "@/lib/marketing-integrations";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function MarketingIntegrationsPage() {
  await requireAdminPermission("PRODUCTS:VIEW");
  const integrations = await readMarketingIntegrations();

  return <main className={styles.main}>
    <div className={styles.titleRow}>
      <div>
        <span>МАРКЕТИНГ</span>
        <h1>Маркетинг интеграции</h1>
        <p>Собственикът въвежда Google, Meta и TikTok ID-та. Сайтът ги зарежда само според cookie съгласието на клиента.</p>
      </div>
    </div>
    <MarketingIntegrationsManager initialIntegrations={integrations} />
  </main>;
}
