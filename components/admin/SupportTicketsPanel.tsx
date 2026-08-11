/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SupportTicketsPanel.module.css";
import { notifyAdminNavAlertsChanged } from "@/lib/admin-nav-alert-live";

type Ticket = any;
type Admin = { id: number; name: string; email: string };

const statusLabels: Record<string, string> = {
  NEW: "Ново",
  IN_PROGRESS: "В обработка",
  WAITING_CUSTOMER: "Очаква клиент",
  CLOSED: "Приключено",
};

const rmaResolutionLabels: Record<string, string> = {
  REFUND: "Възстановяване на сума",
  EXCHANGE: "Замяна на размер/вариант",
  REPLACEMENT: "Замяна с нов продукт",
  REPAIR: "Ремонт",
  STORE_CREDIT: "Кредит в магазина",
  OTHER: "Друго решение",
};

const rmaReasonLabels: Record<string, string> = {
  WRONG_SIZE: "Неподходящ размер",
  DEFECTIVE: "Дефект",
  DAMAGED_IN_TRANSIT: "Повредено при доставка",
  WRONG_ITEM: "Получен грешен артикул",
  NOT_AS_DESCRIBED: "Не отговаря на описанието",
  CHANGED_MIND: "Отказ от покупката",
  OTHER: "Друга причина",
};

function simpleRmaStatus(status: string) {
  if (["REQUESTED", "UNDER_REVIEW"].includes(status)) return "В обработка";
  if (["APPROVED", "PARTIALLY_APPROVED", "AWAITING_RETURN", "IN_TRANSIT", "REFUND_PENDING"].includes(status)) return "Одобрено / в изпълнение";
  if (status === "REJECTED") return "Отказано";
  if (status === "RECEIVED") return "Получено";
  if (status === "REFUNDED") return "Сумата е възстановена";
  if (status === "REPLACEMENT_SENT") return "Замяната е изпратена";
  if (status === "CLOSED") return "Приключено";
  return status;
}

function adminUnreadMessages(ticket: Ticket) {
  const readAt = ticket?.adminReadAt ? new Date(ticket.adminReadAt).getTime() : 0;
  return Array.isArray(ticket?.messages)
    ? ticket.messages.filter((message: any) => !message.isAdmin && new Date(message.createdAt).getTime() > readAt).length
    : 0;
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function SupportTicketsPanel({ initialTickets, admins: _admins }: { initialTickets: Ticket[]; admins: Admin[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [rmaFilter, setRmaFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [rmaDecision, setRmaDecision] = useState("");
  const [rmaTracking, setRmaTracking] = useState("");
  const [rmaRefund, setRmaRefund] = useState("");
  const [refundEdited, setRefundEdited] = useState(false);
  const [rmaApprovedResolution, setRmaApprovedResolution] = useState("");
  const [rmaApprovals, setRmaApprovals] = useState<Record<number, number>>({});
  const replyFileRef = useRef<HTMLInputElement>(null);

  const rmaStatusMatches = (item: Ticket, value: string | null) => {
    const status = item.rmaRequest?.status;
    if (!value) return true;
    if (!status) return false;
    if (value === "ALL") return true;
    if (value === "IN_PROGRESS") return ["REQUESTED", "UNDER_REVIEW"].includes(status);
    if (value === "APPROVED") return ["APPROVED", "PARTIALLY_APPROVED", "AWAITING_RETURN", "IN_TRANSIT", "REFUND_PENDING"].includes(status);
    if (value === "REJECTED") return status === "REJECTED";
    if (value === "RECEIVED") return status === "RECEIVED";
    if (value === "COMPLETED") return ["REFUNDED", "REPLACEMENT_SENT", "CLOSED"].includes(status);
    return false;
  };
  const list = useMemo(() => tickets.filter((item) => (rmaFilter !== null ? Boolean(item.rmaRequest) && rmaStatusMatches(item, rmaFilter) : (filter === "ALL" || item.status === filter)) && (!query || `${item.reference} ${item.rmaRequest?.reference || ""} ${item.subject} ${item.user?.name || item.guestName || ""} ${item.user?.email || item.guestEmail || ""}`.toLowerCase().includes(query.toLowerCase()))), [tickets, filter, rmaFilter, query]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedList = useMemo(() => list.slice((currentPage - 1) * pageSize, currentPage * pageSize), [list, currentPage]);
  const ticket = tickets.find((item) => item.id === selected);
  const calculatedRefund = useMemo(() => {
    if (!ticket?.rmaRequest) return 0;
    return ticket.rmaRequest.items.reduce((sum: number, item: any) => {
      const quantity = rmaApprovals[item.id] ?? item.approvedQuantity ?? item.quantity;
      return sum + Number(item.orderItem?.price ?? 0) * Number(quantity || 0);
    }, 0);
  }, [ticket, rmaApprovals]);


  useEffect(() => {
    setPage(1);
  }, [filter, rmaFilter, query]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (!ticket) return;
    const unreadCount = adminUnreadMessages(ticket);
    if (unreadCount > 0) {
      const readAt = new Date().toISOString();
      setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, adminReadAt: readAt } : item));
      fetch(`/api/admin/support/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markRead" }) })
        .then(() => notifyAdminNavAlertsChanged("/admin/support"))
        .catch(() => {});
    }
    const rma = ticket.rmaRequest;
    setRmaDecision(rma?.adminDecision || "");
    setRmaTracking(rma?.returnTrackingNumber || "");
    const approvals = Object.fromEntries((rma?.items || []).map((item: any) => [item.id, item.approvedQuantity ?? item.quantity]));
    const automaticRefund = (rma?.items || []).reduce((sum: number, item: any) => sum + Number(item.orderItem?.price ?? 0) * Number(approvals[item.id] ?? item.quantity), 0);
    const hasSavedRefund = rma?.refundAmount !== null && rma?.refundAmount !== undefined;
    setRmaRefund(hasSavedRefund ? String(rma.refundAmount) : automaticRefund.toFixed(2));
    setRefundEdited(hasSavedRefund);
    setRmaApprovedResolution(rma?.approvedResolution || rma?.requestedResolution || "");
    setRmaApprovals(approvals);
  // Initialization must run only when the selected conversation changes; depending on the full ticket would loop after adminReadAt/state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket?.rmaRequest || refundEdited) return;
    setRmaRefund(calculatedRefund.toFixed(2));
  }, [calculatedRefund, refundEdited, ticket?.rmaRequest]);

  async function readApiResponse(response: Response) {
    const text = await response.text();
    if (!text.trim()) return {} as { error?: string };
    try { return JSON.parse(text) as { error?: string }; }
    catch { return { error: `Сървърът върна невалиден отговор (HTTP ${response.status}).` }; }
  }

  async function patch(payload: any) {
    if (!ticket) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || `Операцията не беше изпълнена (HTTP ${response.status}).`);
      if (payload.status) {
        setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status: payload.status } : item));
      } else {
        location.reload();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Грешка");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("message", reply.trim());
      fd.set("sendEmail", "true");
      replyFiles.forEach((file) => fd.append("files", file));
      const response = await fetch(`/api/admin/support/${ticket.id}`, { method: "POST", body: fd });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || `Отговорът не беше изпратен (HTTP ${response.status}).`);
      location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Грешка");
    } finally {
      setBusy(false);
    }
  }

  function rmaPayload(rmaStatus: string) {
    if (!ticket?.rmaRequest) return {};
    return {
      action: "rma",
      rmaStatus,
      approvedResolution: rmaApprovedResolution || null,
      refundAmount: rmaStatus === "REJECTED" ? null : (rmaRefund === "" ? null : Number(rmaRefund)),
      returnTrackingNumber: rmaTracking,
      adminDecision: rmaDecision,
      itemApprovals: ticket.rmaRequest.items.map((item: any) => ({ id: item.id, approvedQuantity: rmaApprovals[item.id] ?? item.quantity })),
    };
  }

  function approvalStatus() {
    if (!ticket?.rmaRequest) return "APPROVED";
    const partial = ticket.rmaRequest.items.some((item: any) => (rmaApprovals[item.id] ?? item.quantity) < item.quantity);
    return partial ? "PARTIALLY_APPROVED" : "APPROVED";
  }

  function setRefundValue(raw: string) {
    if (raw === "") { setRmaRefund(""); setRefundEdited(true); return; }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(value, calculatedRefund));
    setRmaRefund(String(clamped));
    setRefundEdited(true);
  }

  function refundStatusLabel(rma: any) {
    if (rma.status === "REJECTED") return "Отказано — няма възстановяване";
    if (rma.status === "REFUNDED") return "Сумата е възстановена";
    if (rma.approvedResolution === "REFUND" || rma.requestedResolution === "REFUND") {
      if (["APPROVED", "PARTIALLY_APPROVED", "AWAITING_RETURN", "IN_TRANSIT", "RECEIVED", "REFUND_PENDING"].includes(rma.status)) return "Одобрено — очаква възстановяване";
      return "Очаква решение";
    }
    return "Без парично възстановяване";
  }

  const filters = ["ALL", "NEW", "IN_PROGRESS", "WAITING_CUSTOMER", "CLOSED"];
  const rmaFilters = [
    ["ALL", "Всички RMA"],
    ["IN_PROGRESS", "В обработка"],
    ["APPROVED", "Одобрени"],
    ["REJECTED", "Отказани"],
    ["RECEIVED", "Получени"],
    ["COMPLETED", "Възстановени / приключени"],
  ] as const;

  return <div className={styles.shell}>
    <aside className={styles.list}>
      <div className={styles.listHeader}><span>Разговори</span><b>{list.length}</b></div>
      <input className={styles.searchInput} placeholder="Търси клиент или референция..." value={query} onChange={(event) => setQuery(event.target.value)} />
      {paginatedList.map((item) => { const unreadCount = adminUnreadMessages(item); return <button className={styles.ticket} data-active={selected === item.id} data-unread={unreadCount > 0} key={item.id} onClick={() => { setSelected(item.id); setReply(""); setReplyFiles([]); }} aria-label={`${item.reference}, ${item.topicLabel}${unreadCount ? `, ${unreadCount} нови съобщения` : ""}`}>
        <div className={styles.ticketTopRow}>
          <b className={styles.ticketReference}>{item.reference}</b>
          <span className={styles.ticketStatus}>{unreadCount ? `${formatUnreadCount(unreadCount)} нови` : statusLabels[item.status]}{item.rmaRequest ? ` · ${simpleRmaStatus(item.rmaRequest.status)}` : ""}</span>
        </div>
        <span className={styles.ticketTopic}>{item.topicLabel}{unreadCount ? <strong className={styles.unreadBadge}>{formatUnreadCount(unreadCount)}</strong> : null}</span>
        <small className={styles.ticketMeta}>{item.user?.name || item.guestName} · {new Date(item.createdAt).toLocaleDateString("bg-BG")}</small>
      </button>; })}
      {list.length > pageSize ? <div className={styles.pagination}>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Предишна страница">‹</button>
        <span>{currentPage} / {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Следваща страница">›</button>
      </div> : null}
    </aside>

    <section className={styles.detail}>{ticket ? <>
      <header><div><span>{ticket.reference}</span><h2>{ticket.subject}</h2><p>{ticket.topicLabel} · {ticket.user?.name || ticket.guestName} · {ticket.user?.email || ticket.guestEmail}</p></div></header>

      <div className={styles.simpleStatusControl}><label>Статус на разговора<select value={ticket.status} onChange={(event) => patch({ action: "update", status: event.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>

      {ticket.order ? <div className={styles.order}><strong>Свързана поръчка</strong> · {new Date(ticket.order.createdAt).toLocaleDateString("bg-BG")} · {ticket.order.total.toFixed(2)} €<div>{ticket.order.items?.map((item: any) => <span key={item.id}>{item.name} · размер {item.size} · {item.quantity} бр.</span>)}</div></div> : null}

      {ticket.rmaRequest ? <section className={styles.rmaCard}>
        <div className={styles.rmaTitle}><div><span>ВРЪЩАНЕ / РЕКЛАМАЦИЯ</span><h3>{ticket.rmaRequest.reference}</h3></div><b>{simpleRmaStatus(ticket.rmaRequest.status)}</b></div>
        <div className={styles.rmaMeta}><p><span>Причина</span><strong>{rmaReasonLabels[ticket.rmaRequest.reason] || ticket.rmaRequest.reason}</strong></p><p><span>Клиентът иска</span><strong>{rmaResolutionLabels[ticket.rmaRequest.requestedResolution] || ticket.rmaRequest.requestedResolution}</strong></p></div>
        <div className={styles.refundSummary}>
          <p><span>RMA статус</span><strong>{simpleRmaStatus(ticket.rmaRequest.status)}</strong></p>
          <p><span>Финансов статус</span><strong>{refundStatusLabel(ticket.rmaRequest)}</strong></p>
          <p><span>{ticket.rmaRequest.status === "REFUNDED" ? "Възстановена сума" : "Сума по избраните артикули"}</span><strong>{ticket.rmaRequest.status === "REJECTED" ? "0.00" : Number(ticket.rmaRequest.status === "REFUNDED" && ticket.rmaRequest.refundAmount != null ? ticket.rmaRequest.refundAmount : (rmaRefund === "" ? calculatedRefund : Number(rmaRefund))).toFixed(2)} €</strong></p>
        </div>
        {ticket.rmaRequest.customerNote ? <p className={styles.rmaCustomerNote}>{ticket.rmaRequest.customerNote}</p> : null}

        <div className={styles.rmaProducts}><h4>Артикули</h4>{ticket.rmaRequest.items.map((item: any) => <div key={item.id}><span><strong>{item.orderItem.name}</strong><small>Размер {item.orderItem.size} · {Number(item.orderItem.price).toFixed(2)} € / бр. · заявени {item.quantity} бр.{item.restockedQuantity ? ` · върнати в наличност ${item.restockedQuantity} бр.` : ""}</small></span><label>Одобрени<select value={rmaApprovals[item.id] ?? item.quantity} onChange={(event) => setRmaApprovals((current) => ({ ...current, [item.id]: Number(event.target.value) }))}>{Array.from({ length: item.quantity + 1 }, (_, quantity) => quantity).map((quantity) => <option key={quantity} value={quantity}>{quantity} бр.</option>)}</select></label></div>)}</div>

        <div className={styles.rmaAdminGrid}>
          <label><span className={styles.fieldTitle}>Решение</span><select value={rmaApprovedResolution} onChange={(event) => setRmaApprovedResolution(event.target.value)}><option value="">Избери</option><option value="REFUND">Възстановяване на сума</option><option value="EXCHANGE">Замяна на размер/вариант</option><option value="REPLACEMENT">Замяна с нов продукт</option><option value="OTHER">Друго</option></select><small className={styles.fieldHint}>Избери начина, по който ще бъде приключена рекламацията.</small></label>
          <label className={styles.refundField}><span className={styles.fieldTitle}>Сума за възстановяване (€)</span><input type="number" min="0" max={calculatedRefund} step="0.01" value={rmaRefund} onChange={(event) => setRefundValue(event.target.value)} /><small className={styles.fieldHint}>Автоматично: <b>{calculatedRefund.toFixed(2)} €</b>. Може само да се намалява.{refundEdited ? <button type="button" className={styles.resetRefund} onClick={() => { setRefundEdited(false); setRmaRefund(calculatedRefund.toFixed(2)); }}>Върни автоматичната</button> : null}</small></label>
          <label><span className={styles.fieldTitle}>Tracking / товарителница</span><input maxLength={120} value={rmaTracking} onChange={(event) => setRmaTracking(event.target.value)} placeholder="По желание" /><small className={styles.fieldHint}>Попълни само ако има обратна пратка.</small></label>
        </div>
        <label className={styles.rmaDecision}>Решение / инструкции към клиента<textarea value={rmaDecision} maxLength={5000} onChange={(event) => setRmaDecision(event.target.value)} placeholder="Напиши какво трябва да направи клиентът или причината за отказ..." /></label>
        <div className={styles.rmaSimpleActions}>
          <button disabled={busy} onClick={() => patch(rmaPayload("UNDER_REVIEW"))}>В обработка</button>
          <button disabled={busy} data-kind="approve" onClick={() => patch(rmaPayload(approvalStatus()))}>Одобри</button>
          <button disabled={busy} data-kind="reject" onClick={() => patch(rmaPayload("REJECTED"))}>Откажи</button>
          <button disabled={busy} onClick={() => patch(rmaPayload("RECEIVED"))}>Получено</button>
          {rmaApprovedResolution === "REFUND" ? <button disabled={busy} data-kind="finish" onClick={() => patch(rmaPayload("REFUNDED"))}>Сумата е възстановена</button> : <button disabled={busy} data-kind="finish" onClick={() => patch(rmaPayload("CLOSED"))}>Приключи</button>}
        </div>
      </section> : null}

      <div className={styles.messages}>{ticket.messages.map((message: any) => <article data-admin={message.isAdmin} key={message.id}><div className={styles.messageHead}><b>{message.isAdmin ? "Обслужване" : "Клиент"}</b>{message.emailStatus ? <span>{message.emailStatus === "SENT" ? "Имейл изпратен" : message.emailStatus === "FAILED" ? "Имейлът не е изпратен" : "Изпращане..."}</span> : null}</div><p>{message.body}</p>{ticket.attachments.filter((attachment: any) => attachment.messageId === message.id || (message.id === ticket.messages[0]?.id && attachment.messageId === null)).length ? <div className={styles.messageFiles}>{ticket.attachments.filter((attachment: any) => attachment.messageId === message.id || (message.id === ticket.messages[0]?.id && attachment.messageId === null)).map((attachment: any) => <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id}>{attachment.fileName}</a>)}</div> : null}<small>{new Date(message.createdAt).toLocaleString("bg-BG")}</small></article>)}</div>

      <div className={styles.reply}>
        <label>Отговор към клиента</label>
        <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Напиши отговор..." />
        <input ref={replyFileRef} className={styles.hiddenFile} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,application/zip,application/x-zip-compressed" onChange={(event) => setReplyFiles(Array.from(event.target.files || []).slice(0, 10))} />
        <button type="button" className={styles.attachButton} onClick={() => replyFileRef.current?.click()}>＋ Прикачи файлове {replyFiles.length ? `(${replyFiles.length})` : ""}</button>
        {replyFiles.length ? <div className={styles.replyFileList}>{replyFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setReplyFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div> : null}
        <div className={styles.replyActions}><button className={styles.emailButton} disabled={busy || !reply.trim()} onClick={sendReply}>Изпрати отговор</button></div>
        <p>Отговорът се записва в чата и системата опитва да изпрати копие по имейл.</p>
      </div>
    </> : <div className={styles.emptyDetail}>Избери разговор</div>}</section>

    <aside className={styles.statusMenu}>
      <nav>
        {filters.map((status) => <button key={status} data-active={rmaFilter === null && filter === status} onClick={() => { setRmaFilter(null); setFilter(status); }}><span>{status === "ALL" ? "Всички" : statusLabels[status]}</span><b>{status === "ALL" ? tickets.length : tickets.filter((item) => item.status === status).length}</b></button>)}
        <button data-active={rmaFilter !== null} onClick={() => { setFilter("ALL"); setRmaFilter(rmaFilter === null ? "ALL" : null); }}><span>RMA статус</span><b>{tickets.filter((item) => Boolean(item.rmaRequest)).length}</b></button>
      </nav>
      {rmaFilter !== null ? <div className={styles.rmaStatusFilters}>{rmaFilters.map(([value, label]) => <button key={value} data-active={rmaFilter === value} onClick={() => setRmaFilter(value)}><span>{label}</span><b>{tickets.filter((item) => Boolean(item.rmaRequest) && rmaStatusMatches(item, value)).length}</b></button>)}</div> : null}
    </aside>
  </div>;
}
