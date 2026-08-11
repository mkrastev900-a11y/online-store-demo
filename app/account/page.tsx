import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import AccountOrders from "@/components/account/AccountOrders";
import ProfileCollections from "@/components/account/ProfileCollections";
import ProfileSettingsButton from "@/components/account/ProfileSettingsButton";
import { findPublicUserById } from "@/lib/auth-db";
import { listCustomerOrders } from "@/lib/customer-orders";
import { getSession } from "@/lib/session";
import styles from "./account.module.css";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/account");
  }

  const [user, orders] = await Promise.all([
    findPublicUserById(session.userId),
    listCustomerOrders(session.userId),
  ]);

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <main className={styles.main}>
        <section className={styles.profileCard}>
          <div className={styles.profileHeading}>
            <div>
              <span>МОЯТ ПРОФИЛ</span>
              <h1>Здравей, {user.name}</h1>
            </div>

            <div className={styles.profileActions}>
              <ProfileSettingsButton />
              <LogoutButton className={styles.logout} />
            </div>
          </div>

          <div className={styles.profileDetails}>
            <div>
              <span>Имейл</span>
              <strong>{user.email}</strong>
            </div>

            <div>
              <span>Телефон</span>
              <strong>{user.phone || "Не е добавен"}</strong>
            </div>
          </div>

          <div className={styles.quickLinks}>
            <Link href="#orders">Моите поръчки</Link>
            <Link href="/cart">Моята количка</Link>
            <Link href="/favorites">Всички любими</Link>
            <Link href="/history">Цяла хронология</Link>
          </div>
        </section>

        <AccountOrders orders={orders} />


        <ProfileCollections />
      </main>
    </>
  );
}
