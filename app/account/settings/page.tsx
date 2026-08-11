import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileInfoForm from "@/components/account/ProfileInfoForm";
import ProfileSecuritySettings from "@/components/account/ProfileSecuritySettings";
import { findPublicUserById } from "@/lib/auth-db";
import { getSession } from "@/lib/session";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/settings");

  const user = await findPublicUserById(session.userId);
  if (!user) redirect("/login");

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div>
          <span>НАСТРОЙКИ НА ПРОФИЛА</span>
          <h1>Лични данни и сигурност</h1>
          <p>Управлявай данните, паролата и предпочитанията си за поверителност от едно място.</p>
        </div>
        <Link href="/account" className={styles.backLink}>← Към профила</Link>
      </section>

      <ProfileInfoForm profile={user} />
      <ProfileSecuritySettings authProvider={user.authProvider} termsAcceptedAt={user.termsAcceptedAt ? user.termsAcceptedAt.toISOString() : null} termsVersion={user.termsVersion ?? null} />
    </main>
  );
}
