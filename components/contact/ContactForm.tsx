/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element, @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyContactProfile, formatContactOrderOption, type ContactOrderSummary } from "@/lib/contact-prefill";
import { phoneCharactersOnly } from "@/lib/numeric-fields";
import styles from "./ContactForm.module.css";
import { notifyAdminNavAlertsChanged } from "@/lib/admin-nav-alert-live";
import { announceSupportUnreadUpdate, SUPPORT_UNREAD_BROADCAST_CHANNEL, SUPPORT_UNREAD_STORAGE_KEY, SUPPORT_UNREAD_UPDATED_EVENT } from "@/lib/support-unread";

type ViewMode = "new" | "conversations";
type Intent = "GENERAL" | "ORDER" | "RETURN";

const labels: Record<string, string> = {
  GENERAL: "Общо запитване",
  OTHER: "Друго",
  ORDER_QUESTION: "Въпрос за поръчка",
  DAMAGED_SHIPMENT: "Нарушена пратка",
  CLAIM: "Рекламация",
  RETURN_REQUEST: "Връщане на продукт",
  WARRANTY: "Гаранция",
};

const rmaReasons = [
  ["WRONG_SIZE", "Неподходящ размер"],
  ["DEFECTIVE", "Дефект"],
  ["DAMAGED_IN_TRANSIT", "Повредено при доставка"],
  ["WRONG_ITEM", "Получен грешен артикул"],
  ["NOT_AS_DESCRIBED", "Не отговаря на описанието"],
  ["CHANGED_MIND", "Отказ от покупката"],
  ["OTHER", "Друга причина"],
] as const;

const rmaResolutions = [
  ["REFUND", "Възстановяване на сума"],
  ["EXCHANGE", "Замяна на размер/вариант"],
  ["REPLACEMENT", "Замяна с нов продукт"],
  ["OTHER", "Друго решение"],
] as const;

function publicRmaStatus(status: string) {
  if (["REQUESTED", "UNDER_REVIEW"].includes(status)) return "В обработка";
  if (["APPROVED", "PARTIALLY_APPROVED", "AWAITING_RETURN", "IN_TRANSIT", "RECEIVED", "REFUND_PENDING"].includes(status)) return "Одобрено / в изпълнение";
  if (status === "REJECTED") return "Отказано";
  return "Приключено";
}

function publicTicketStatus(status: string) {
  if (status === "NEW") return "Ново";
  if (status === "IN_PROGRESS") return "В обработка";
  if (status === "WAITING_CUSTOMER") return "Очаква твоя отговор";
  return "Приключено";
}

function topicToIntent(topic: string): Intent {
  if (["RETURN_REQUEST", "CLAIM", "DAMAGED_SHIPMENT", "WARRANTY"].includes(topic)) return "RETURN";
  if (topic === "ORDER_QUESTION") return "ORDER";
  return "GENERAL";
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function unreadMessageLabel(count: number) {
  return count === 1 ? "1 непрочетено съобщение" : `${count} непрочетени съобщения`;
}

function ticketUnreadMessages(ticket: any) {
  const apiCount = Number(ticket?.customerUnreadMessages);
  if (Number.isFinite(apiCount)) return Math.max(0, Math.floor(apiCount));

  const readAt = ticket?.customerReadAt ? new Date(ticket.customerReadAt).getTime() : 0;
  return Array.isArray(ticket?.messages)
    ? ticket.messages.filter((message: any) => message.isAdmin && new Date(message.createdAt).getTime() > readAt).length
    : 0;
}

function ticketUnreadTime(ticket: any) {
  return new Date(ticket?.lastAdminMessageAt || ticket?.updatedAt || ticket?.createdAt || 0).getTime() || 0;
}

export default function ContactForm() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "guest" | "error">("loading");
  const [view, setView] = useState<ViewMode>("new");
  const [orders, setOrders] = useState<ContactOrderSummary[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const ticketFileRef = useRef<HTMLInputElement>(null);

  const [intent, setIntent] = useState<Intent>("GENERAL");
  const [v, setV] = useState({ name: "", email: "", phone: "", topic: "GENERAL", orderId: "", message: "", consent: false });
  const [rma, setRma] = useState<{ reason: string; resolution: string; note: string; quantities: Record<number, number> }>({ reason: "", resolution: "REFUND", note: "", quantities: {} });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authenticated = status === "authenticated";
  const needsOrder = intent !== "GENERAL";
  const needsRma = intent === "RETURN";
  const selectedOrder = orders.find((order) => String(order.id) === v.orderId);
  const selectedTicket = useMemo(() => tickets.find((ticket: any) => ticket.id === selectedTicketId), [tickets, selectedTicketId]);
  const supportUnreadMessages = useMemo(() => tickets.reduce((sum, ticket) => sum + ticketUnreadMessages(ticket), 0), [tickets]);
  const sortedTickets = useMemo(() => [...tickets].sort((left, right) => {
    const rightUnread = ticketUnreadMessages(right);
    const leftUnread = ticketUnreadMessages(left);
    if ((rightUnread > 0) !== (leftUnread > 0)) return rightUnread > 0 ? 1 : -1;
    return ticketUnreadTime(right) - ticketUnreadTime(left);
  }), [tickets]);

  const loadData = useCallback(async (preferredReference?: string) => {
    const response = await fetch("/api/contact", { cache: "no-store", credentials: "include" });
    const data = await response.json();
    setStatus(data.authenticated ? "authenticated" : "guest");
    setOrders(data.orders || []);
    setTickets(data.tickets || []);
    const preferred = preferredReference ? (data.tickets || []).find((ticket: any) => ticket.reference === preferredReference) : null;
    setSelectedTicketId((current) => {
      const nextTickets = data.tickets || [];
      if (preferred?.id) return preferred.id;
      return current && nextTickets.some((ticket: any) => ticket.id === current) ? current : null;
    });
    if (data.profile) {
      setV((current) => applyContactProfile(current, data.profile) as typeof current);
    }
    return data;
  }, []);

  useEffect(() => {
    loadData()
      .then((data) => {
        const params = new URLSearchParams(window.location.search);
        const topic = params.get("topic") || "";
        const orderId = params.get("orderId") || "";
        if (topic) {
          const nextIntent = topicToIntent(topic);
          setIntent(nextIntent);
          setV((current) => ({
            ...current,
            topic: ["GENERAL", "ORDER_QUESTION", "DAMAGED_SHIPMENT", "CLAIM", "RETURN_REQUEST", "WARRANTY"].includes(topic) ? topic : nextIntent === "ORDER" ? "ORDER_QUESTION" : "GENERAL",
            orderId: data.authenticated ? orderId : "",
          }));
          setView("new");
        } else if (data.authenticated && (data.tickets || []).length) {
          setView("conversations");
        }
      })
      .catch(() => setStatus("error"));
  }, [loadData]);

  useEffect(() => {
    if (!authenticated) return;

    let refreshTimeout = 0;
    let channel: BroadcastChannel | null = null;

    function refreshConversations() {
      if (document.visibilityState === "hidden") return;
      void loadData();
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(refreshConversations, 120);
    }

    function onStorage(event: StorageEvent) {
      if (event.key === SUPPORT_UNREAD_STORAGE_KEY && event.newValue) scheduleRefresh();
    }

    window.addEventListener(SUPPORT_UNREAD_UPDATED_EVENT, scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", scheduleRefresh);
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(SUPPORT_UNREAD_BROADCAST_CHANNEL);
        channel.onmessage = scheduleRefresh;
      }
    } catch {
      channel = null;
    }

    return () => {
      window.clearTimeout(refreshTimeout);
      channel?.close();
      window.removeEventListener(SUPPORT_UNREAD_UPDATED_EVENT, scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", scheduleRefresh);
    };
  }, [authenticated, loadData]);

  function chooseIntent(next: Intent) {
    setIntent(next);
    setResult(null);
    setRma({ reason: "", resolution: "REFUND", note: "", quantities: {} });
    setV((current) => ({
      ...current,
      topic: next === "GENERAL" ? "GENERAL" : next === "ORDER" ? "ORDER_QUESTION" : "RETURN_REQUEST",
      orderId: next === "GENERAL" ? "" : current.orderId,
      message: "",
    }));
  }

  function chooseFiles(list: FileList | null) {
    const selected = Array.from(list || []);
    setFiles((current) => {
      const merged = [...current, ...selected];
      const unique = merged.filter((file, index, all) => all.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index);
      return unique.slice(0, 10);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function replyTo(ticketId: number) {
    const message = ticketReply.trim();
    if (!message) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("message", message);
      ticketFiles.forEach((file) => fd.append("files", file));
      const response = await fetch(`/api/contact/${ticketId}`, { method: "POST", body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Съобщението не беше изпратено.");
      setTicketReply("");
      setTicketFiles([]);
      if (ticketFileRef.current) ticketFileRef.current.value = "";
      if (data.summary) announceSupportUnreadUpdate(data.summary);
      notifyAdminNavAlertsChanged("/admin/support");
      await loadData();
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "Грешка" });
    } finally {
      setBusy(false);
    }
  }

  function openTicket(id: number) {
    const openedAt = new Date().toISOString();
    const openedTicket = tickets.find((ticket: any) => ticket.id === id);
    const unreadCount = ticketUnreadMessages(openedTicket);
    setSelectedTicketId(id);
    setTicketReply("");
    setTicketFiles([]);
    if (!unreadCount) return;
    setTickets((current) => current.map((ticket: any) => ticket.id === id ? { ...ticket, customerReadAt: openedAt, customerUnreadMessages: 0 } : ticket));
    fetch(`/api/contact/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markRead" }) })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "read-failed");
        if (data?.summary) announceSupportUnreadUpdate(data.summary);
        else announceSupportUnreadUpdate();
      })
      .catch(() => {
        void loadData();
        announceSupportUnreadUpdate();
      });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("name", v.name);
      fd.set("email", v.email);
      fd.set("phone", v.phone);
      fd.set("topic", v.topic);
      fd.set("orderId", v.orderId);
      fd.set("message", v.message);
      fd.set("consent", String(v.consent));
      fd.set("subject", labels[v.topic] || "Обслужване на клиенти");
      fd.set("website", String(new FormData(event.currentTarget).get("website") || ""));
      if (needsRma) {
        const selectedRmaItems = Object.entries(rma.quantities).filter(([, qty]) => qty > 0);
        if (!selectedRmaItems.length) {
          throw new Error("Избери поне един артикул от поръчката и количество.");
        }
        fd.set("rmaReason", rma.reason);
        fd.set("rmaResolution", rma.resolution);
        fd.set("rmaNote", rma.note);
        fd.set("rmaItems", JSON.stringify(selectedRmaItems.map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity }))));
      }
      files.forEach((file) => fd.append("files", file));
      const response = await fetch("/api/contact", { method: "POST", body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Запитването не беше изпратено.");
      notifyAdminNavAlertsChanged("/admin/support");
      setV((current) => ({ ...current, topic: "GENERAL", orderId: "", message: "", consent: false }));
      setIntent("GENERAL");
      setRma({ reason: "", resolution: "REFUND", note: "", quantities: {} });
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setResult({ ok: true, text: "Разговорът е създаден. Можеш да продължиш да пишеш в него." });
      if (authenticated) {
        await loadData(data.reference);
        setView("conversations");
      }
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "Възникна грешка." });
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <div className={`${styles.contactForm} ${styles.contactFormLoading}`}>Зареждане...</div>;

  return (
    <div className={styles.contactForm}>
      <div className={styles.supportTabs}>
        <button type="button" data-active={view === "new"} onClick={() => setView("new")}>Нов разговор</button>
        {authenticated ? <button type="button" data-active={view === "conversations"} onClick={() => setView("conversations")} aria-label={supportUnreadMessages ? `Моите разговори, ${unreadMessageLabel(supportUnreadMessages)}` : undefined}><span>Моите разговори</span>{supportUnreadMessages ? <span className={styles.tabUnreadBadge}>{formatUnreadCount(supportUnreadMessages)}</span> : null}</button> : null}
      </div>

      {view === "new" ? (
        <form onSubmit={submit}>
          <div className={styles.profileNotice} data-state={status}>
            {authenticated ? <span><strong>Пишеш като {v.name || "клиент"}.</strong> За проблем с поръчка избери поръчката и системата ще свърже разговора автоматично.</span> : <span>Като гост можеш да изпратиш общ въпрос. За поръчка, връщане или рекламация <a href="/login?next=/contact">влез в профила си</a>.</span>}
          </div>

          <div className={styles.intentGrid}>
            <button type="button" data-active={intent === "GENERAL"} onClick={() => chooseIntent("GENERAL")}><strong>Имам въпрос</strong><span>Общо запитване към магазина</span></button>
            {authenticated ? <button type="button" data-active={intent === "ORDER"} onClick={() => chooseIntent("ORDER")}><strong>Въпрос за поръчка</strong><span>Доставка, плащане или статус</span></button> : null}
            {authenticated ? <button type="button" data-active={intent === "RETURN"} onClick={() => chooseIntent("RETURN")}><strong>Проблем / връщане</strong><span>Рекламация, повреда, връщане или гаранция</span></button> : null}
          </div>

          <div className={styles.formGrid}>
            {!authenticated ? <>
              <label className={styles.field}><span>Име и фамилия *</span><input required minLength={2} maxLength={100} value={v.name} onChange={(e) => setV((current) => ({ ...current, name: e.target.value }))} /></label>
              <label className={styles.field}><span>Имейл *</span><input required type="email" value={v.email} onChange={(e) => setV((current) => ({ ...current, email: e.target.value }))} /></label>
              <label className={styles.field}><span>Телефон</span><input inputMode="tel" pattern="[+]?[0-9]+" autoComplete="tel" value={v.phone} onChange={(e) => setV((current) => ({ ...current, phone: phoneCharactersOnly(e.target.value) }))} /></label>
            </> : null}

            {authenticated && needsOrder ? <label className={`${styles.field} ${styles.fullWidth} ${styles.orderPicker}`}><span>Избери поръчка *</span><select required value={v.orderId} onChange={(e) => { setV((current) => ({ ...current, orderId: e.target.value })); setRma((current) => ({ ...current, quantities: {} })); }}><option value="">Избери поръчка</option>{orders.map((order) => <option key={order.id} value={order.id}>{formatContactOrderOption(order)}</option>)}</select>{!orders.length ? <small className={styles.fieldHelp}>В профила няма намерени поръчки.</small> : null}</label> : null}

            {authenticated && needsRma ? <label className={`${styles.field} ${styles.fullWidth}`}><span>Какъв е проблемът? *</span><select required value={v.topic} onChange={(e) => setV((current) => ({ ...current, topic: e.target.value }))}><option value="RETURN_REQUEST">Искам да върна продукт</option><option value="CLAIM">Искам да направя рекламация</option><option value="DAMAGED_SHIPMENT">Пратката е повредена</option><option value="WARRANTY">Гаранционен проблем</option></select></label> : null}

            {authenticated && needsRma && selectedOrder ? <section className={`${styles.fullWidth} ${styles.rmaBox}`}>
              <div className={styles.rmaHeading}><div><span>АРТИКУЛИ</span><h3>Кое искаш да върнеш или рекламираш?</h3></div></div>
              <p className={styles.rmaInstruction}>Избери един или повече артикули от тази поръчка. При отметка количеството започва от 1 бр.</p>
              <div className={styles.rmaItems}>{selectedOrder.items.map((item) => {
                const selectedQuantity = rma.quantities[item.id] || 0;
                const isSelected = selectedQuantity > 0;
                return <div key={item.id} className={styles.rmaItem} data-selected={isSelected}>
                  <label className={styles.rmaItemChoice}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => setRma((current) => ({
                        ...current,
                        quantities: { ...current.quantities, [item.id]: e.target.checked ? Math.max(1, current.quantities[item.id] || 0) : 0 },
                      }))}
                    />
                    {item.product?.imageUrl ? <img src={item.product.imageUrl} alt="" className={styles.rmaItemImage} /> : <span className={styles.rmaItemImagePlaceholder}>СНИМКА</span>}
                    <span className={styles.rmaItemInfo}>
                      <strong>{item.name}</strong>
                      <span>Размер: {item.size || "—"}{item.product?.color ? ` · Цвят: ${item.product.color}` : ""}</span>
                      <span>Закупено количество: {item.quantity} бр. · {Number(item.price).toFixed(2)} € / бр.</span>
                    </span>
                  </label>
                  <label className={styles.rmaQuantity}>
                    <span>Количество</span>
                    <select aria-label={`Количество за ${item.name}`} disabled={!isSelected} value={selectedQuantity} onChange={(e) => setRma((current) => ({ ...current, quantities: { ...current.quantities, [item.id]: Number(e.target.value) } }))}>
                      {isSelected ? Array.from({ length: item.quantity }, (_, index) => index + 1).map((quantity) => <option key={quantity} value={quantity}>{quantity} бр.</option>) : <option value={0}>—</option>}
                    </select>
                  </label>
                </div>;
              })}</div>
              <div className={styles.rmaGrid}>
                <label className={styles.field}><span>Причина *</span><select required value={rma.reason} onChange={(e) => setRma((current) => ({ ...current, reason: e.target.value }))}><option value="">Избери причина</option>{rmaReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className={styles.field}><span>Какво решение предпочиташ? *</span><select required value={rma.resolution} onChange={(e) => setRma((current) => ({ ...current, resolution: e.target.value }))}>{rmaResolutions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label className={styles.field}><span>Допълнение</span><textarea rows={3} maxLength={2000} placeholder="Например кой размер искаш при замяна или къде е дефектът..." value={rma.note} onChange={(e) => setRma((current) => ({ ...current, note: e.target.value }))} /></label>
            </section> : null}

            <label className={`${styles.field} ${styles.fullWidth}`}><span>{needsRma ? "Опиши проблема *" : "Съобщение *"}</span><textarea required minLength={10} maxLength={5000} rows={7} placeholder={needsRma ? "Опиши накратко какъв е проблемът..." : "Напиши как можем да помогнем..."} value={v.message} onChange={(e) => setV((current) => ({ ...current, message: e.target.value }))} /><small>{v.message.length}/5000</small></label>

            {authenticated ? <div className={`${styles.field} ${styles.fullWidth}`}><span>Снимки и файлове</span><input ref={fileInputRef} className={styles.nativeFileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,application/zip,application/x-zip-compressed" onChange={(e) => chooseFiles(e.target.files)} /><button type="button" className={styles.fileUploadButton} onClick={() => fileInputRef.current?.click()}><span className={styles.fileUploadIcon} aria-hidden="true">＋</span><span><strong>{files.length ? "Добави още файлове" : "Прикачи снимки или файлове"}</strong><small>По желание · до 10 файла</small></span></button>{files.length ? <div className={styles.fileList}>{files.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.fileItem}><span className={styles.fileBadge}>{file.type.startsWith("image/") ? "СНИМКА" : file.type.includes("pdf") ? "PDF" : "ФАЙЛ"}</span><span className={styles.fileMeta}><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></div>)}</div> : null}</div> : null}
          </div>

          <label className={styles.honeypot}>Уебсайт<input name="website" tabIndex={-1} /></label>
          <label className={styles.consent}><input type="checkbox" checked={v.consent} onChange={(e) => setV((current) => ({ ...current, consent: e.target.checked }))} /><span>Съгласен/на съм данните да бъдат използвани за обработване на запитването ми. *</span></label>
          {result ? <div className={result.ok ? styles.success : styles.error}>{result.text}</div> : null}
          <button className={styles.submitButton} disabled={busy}>{busy ? "Изпращане..." : "Започни разговор"}</button>
        </form>
      ) : (
        <section className={styles.myTickets}>
          {result ? <div className={result.ok ? styles.success : styles.error}>{result.text}</div> : null}
          {!tickets.length ? <div className={styles.ticketChatEmpty}>Все още нямаш разговори с обслужването.</div> : <div className={styles.ticketCenter}>
            <aside className={styles.ticketList}>{sortedTickets.map((ticket: any) => { const unreadCount = ticketUnreadMessages(ticket); return <button type="button" data-active={selectedTicketId === ticket.id} data-unread={unreadCount > 0} aria-label={`${ticket.reference}, ${labels[ticket.topic] || ticket.topic}, ${publicTicketStatus(ticket.status)}${unreadCount ? `, ${unreadMessageLabel(unreadCount)}` : ""}`} onClick={() => openTicket(ticket.id)} key={ticket.id}><b>{ticket.reference}</b><span className={styles.ticketListTitle}><span>{labels[ticket.topic] || ticket.topic}</span>{unreadCount ? <span className={styles.ticketUnreadBadge}>{formatUnreadCount(unreadCount)}</span> : null}</span><small>{publicTicketStatus(ticket.status)}</small>{unreadCount ? <em>{unreadMessageLabel(unreadCount)}</em> : null}</button>; })}</aside>
            {selectedTicket ? <article className={styles.ticketChat}>
              <header><div><b>{selectedTicket.reference}</b><span>{labels[selectedTicket.topic] || selectedTicket.topic}</span></div><em>{publicTicketStatus(selectedTicket.status)}</em></header>
              {selectedTicket.orderId ? <p className={styles.linkedOrder}>Свързано с твоя поръчка.</p> : null}
              {selectedTicket.rmaRequest ? <div className={styles.rmaSummary}><div><b>Връщане / рекламация</b><span>{publicRmaStatus(selectedTicket.rmaRequest.status)}</span></div><p>Референция: <strong>{selectedTicket.rmaRequest.reference}</strong></p>{selectedTicket.rmaRequest.adminDecision ? <p>{selectedTicket.rmaRequest.adminDecision}</p> : null}{selectedTicket.rmaRequest.refundAmount !== null && selectedTicket.rmaRequest.refundAmount !== undefined ? <p>Сума за възстановяване: <strong>{Number(selectedTicket.rmaRequest.refundAmount).toFixed(2)} €</strong></p> : null}{selectedTicket.rmaRequest.returnTrackingNumber ? <p>Проследяване: <strong>{selectedTicket.rmaRequest.returnTrackingNumber}</strong></p> : null}</div> : null}
              <div className={styles.ticketMessages}>{selectedTicket.messages.map((message: any) => <div data-admin={message.isAdmin} key={message.id}><strong>{message.isAdmin ? "Обслужване" : "Ти"}</strong><p>{message.body}</p>{selectedTicket.attachments?.filter((attachment: any) => attachment.messageId === message.id || (message.id === selectedTicket.messages[0]?.id && attachment.messageId === null)).length ? <div className={styles.ticketFiles}>{selectedTicket.attachments.filter((attachment: any) => attachment.messageId === message.id || (message.id === selectedTicket.messages[0]?.id && attachment.messageId === null)).map((attachment: any) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">{attachment.fileName}</a>)}</div> : null}<small>{new Date(message.createdAt).toLocaleString("bg-BG")}</small></div>)}</div>
              {selectedTicket.status !== "CLOSED" ? <div className={styles.ticketReply}><textarea placeholder="Напиши съобщение..." value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} /><input ref={ticketFileRef} className={styles.nativeFileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,application/zip,application/x-zip-compressed" onChange={(e) => setTicketFiles(Array.from(e.target.files || []).slice(0, 10))} /><div className={styles.chatActions}><button type="button" className={styles.chatAttach} onClick={() => ticketFileRef.current?.click()}>＋ Файлове {ticketFiles.length ? `(${ticketFiles.length})` : ""}</button><button type="button" disabled={busy || !ticketReply.trim()} onClick={() => replyTo(selectedTicket.id)}>Изпрати</button></div>{ticketFiles.length ? <div className={styles.chatFileNames}>{ticketFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}</span>)}</div> : null}</div> : <p className={styles.closedConversation}>Разговорът е приключен. При нов въпрос започни нов разговор.</p>}
            </article> : <div className={styles.ticketChatEmpty}>Избери разговор</div>}
          </div>}
        </section>
      )}
    </div>
  );
}
