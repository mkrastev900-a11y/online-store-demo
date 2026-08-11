"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CustomerActions.module.css";

type Note = { id: number; content: string; createdAt: string; author: { name: string; email: string } };
type Tag = { id: number; name: string };

type Props = {
  userId: number;
  isActive: boolean;
  crmStatus: string;
  adminNote: string;
  notes: Note[];
  tags: Tag[];
  permissions: { edit: boolean; status: boolean; notes: boolean; tags: boolean; block: boolean };
};

const statuses = [
  ["NEW", "Нов клиент"], ["ACTIVE", "Активен"], ["VIP", "VIP"],
  ["RISK", "Рисков"], ["INACTIVE", "Неактивен"], ["BLOCKED", "Блокиран"],
];

export default function CustomerCrmPanel(props: Props) {
  const router = useRouter();
  const [adminNote, setAdminNote] = useState(props.adminNote);
  const [status, setStatus] = useState(props.crmStatus);
  const [note, setNote] = useState("");
  const [tagName, setTagName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function request(url: string, method: string, body?: unknown) {
    setBusy(true); setMessage("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "Промяната е запазена." : result.error || "Възникна грешка.");
    if (response.ok) { setNote(""); setTagName(""); router.refresh(); }
  }

  return <section className={styles.card}>
    <div><span>CRM УПРАВЛЕНИЕ</span><h2>Статус, бележки и тагове</h2></div>

    <label className={styles.fieldLabel}>CRM статус</label>
    <select value={status} disabled={!props.permissions.status || busy} onChange={(e) => setStatus(e.target.value)}>
      {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {props.permissions.status && <button disabled={busy} onClick={() => request(`/api/admin/customers/${props.userId}`, "PATCH", { crmStatus: status })}>Запази CRM статуса</button>}

    <label className={styles.fieldLabel}>Обща вътрешна бележка</label>
    <textarea value={adminNote} disabled={!props.permissions.edit} onChange={(e) => setAdminNote(e.target.value)} placeholder="Важна постоянна информация за клиента…" />
    {props.permissions.edit && <button disabled={busy} onClick={() => request(`/api/admin/customers/${props.userId}`, "PATCH", { adminNote })}>Запази общата бележка</button>}

    <div className={styles.divider} />
    <label className={styles.fieldLabel}>Нова хронологична бележка</label>
    <textarea value={note} disabled={!props.permissions.notes} onChange={(e) => setNote(e.target.value)} placeholder="Разговор, обещание, рекламация или следваща задача…" />
    {props.permissions.notes && <button disabled={busy || !note.trim()} onClick={() => request(`/api/admin/customers/${props.userId}/notes`, "POST", { content: note })}>Добави бележка</button>}
    <div className={styles.noteList}>{props.notes.map((item) => <article key={item.id}><p>{item.content}</p><small>{item.author.name} · {new Date(item.createdAt).toLocaleString("bg-BG")}</small></article>)}{!props.notes.length && <small>Все още няма CRM бележки.</small>}</div>

    <div className={styles.divider} />
    <label className={styles.fieldLabel}>Тагове</label>
    <div className={styles.tags}>{props.tags.map((tag) => <span key={tag.id}>{tag.name}{props.permissions.tags && <button aria-label={`Премахни ${tag.name}`} onClick={() => request(`/api/admin/customers/${props.userId}/tags/${tag.id}`, "DELETE")}>×</button>}</span>)}</div>
    {props.permissions.tags && <div className={styles.inline}><input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Напр. VIP, На едро, Забавя плащания"/><button disabled={busy || !tagName.trim()} onClick={() => request(`/api/admin/customers/${props.userId}/tags`, "POST", { name: tagName })}>Добави</button></div>}

    {props.permissions.block && <div className={styles.actions}><button disabled={busy} onClick={() => request(`/api/admin/customers/${props.userId}`, "PATCH", { isActive: !props.isActive })}>{props.isActive ? "Блокирай клиента" : "Активирай клиента"}</button></div>}
    {message && <p>{message}</p>}
  </section>;
}
