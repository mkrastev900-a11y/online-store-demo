"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CustomerActions.module.css";

export default function CustomerActions({ userId, isActive, role, note, canManageRole }: { userId: number; isActive: boolean; role: string; note: string; canManageRole: boolean }) {
  const router = useRouter();
  const [adminNote, setAdminNote] = useState(note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(data: Record<string, unknown>) {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/customers/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    setBusy(false); setMessage(response.ok ? "Промяната е запазена." : result.error || "Възникна грешка.");
    if (response.ok) router.refresh();
  }
  return <section className={styles.card}>
    <div><span>АДМИНИСТРАТИВНИ</span><h2>Действия и бележки</h2></div>
    <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Вътрешна бележка за клиента…" />
    <button disabled={busy} onClick={() => update({ adminNote })}>Запази бележката</button>
    <div className={styles.actions}><button disabled={busy} onClick={() => update({ isActive: !isActive })}>{isActive ? "Блокирай клиента" : "Активирай клиента"}</button>{canManageRole && <button disabled={busy} onClick={() => update({ role: role === "ADMIN" ? "CUSTOMER" : "ADMIN" })}>{role === "ADMIN" ? "Премахни Admin" : "Направи Admin"}</button>}</div>
    {message && <p>{message}</p>}
  </section>;
}
