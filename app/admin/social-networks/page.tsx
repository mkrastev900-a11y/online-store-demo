import SocialNetworksManager from "@/components/admin/SocialNetworksManager";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { readSocialNetworks } from "@/lib/social-networks-db";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function SocialNetworksPage() {
  await requireAdminPermission("PRODUCTS:VIEW");
  const socialNetworks = await readSocialNetworks();

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <div>
          <span>СОЦИАЛНИ МРЕЖИ</span>
          <h1>Социални мрежи</h1>
          <p>
            Собственикът въвежда линковете към Facebook, Instagram и TikTok. Иконките в горната черна лента стават преки пътища към профилите.
          </p>
        </div>
      </div>
      <SocialNetworksManager initialSocialNetworks={socialNetworks} />
    </main>
  );
}
