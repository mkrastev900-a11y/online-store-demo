import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
import styles from "./audit.module.css";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  await requireAdminPermission("AUDIT_LOG:VIEW");
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { name:true,email:true } } } });
  return <main className={styles.main}><div className={styles.title}><span>СИГУРНОСТ</span><h1>Дневник на действията</h1><p>Последните {logs.length} административни действия.</p></div><section className={styles.card}>{logs.length ? logs.map((log) => <article key={log.id}><div><span>{log.action}</span><strong>{log.description}</strong><small>{log.actor?.name || "Система"} · {log.actor?.email || "автоматично действие"}</small></div><time>{log.createdAt.toLocaleString("bg-BG")}</time></article>) : <p>Все още няма записани действия.</p>}</section></main>;
}
