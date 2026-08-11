import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import styles from "../admin.module.css";

export default async function AccessDeniedPage() {
  await requireAdmin();
  return (
    <main className={styles.main}>
      <div className={styles.titleRow}><div><span>ОГРАНИЧЕН ДОСТЪП</span><h1>Нямаш право за тази секция</h1></div></div>
      <section style={{ maxWidth: 760, padding: 28, border: "1px solid #e5e7eb", borderRadius: 16, background: "white" }}>
        <p>Секцията или действието не е включено в правата на твоя подадминистраторски акаунт.</p>
        <p>Обърни се към главен администратор, който може да промени достъпа от <strong>Администратори → Права</strong>.</p>
        <Link href="/account">Към профила</Link>
      </section>
    </main>
  );
}
