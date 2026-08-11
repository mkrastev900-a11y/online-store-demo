"use client";

import { FormEvent, useState } from "react";
import type { MarketingEventKey, MarketingIntegrationsStore, MarketingProviderKey, MarketingProviderSettings } from "@/lib/marketing-integrations";
import styles from "./MarketingIntegrationsManager.module.css";

const providerMeta: Array<{ key: MarketingProviderKey; title: string; description: string; placeholder: string; consent: string }> = [
  { key: "google", title: "Google Analytics / Google Tag", description: "Въведи Google Tag ID, например G-XXXXXXXXXX или GTM-XXXXXXX. Зарежда се само при разрешени аналитични бисквитки.", placeholder: "G-XXXXXXXXXX или GTM-XXXXXXX", consent: "Аналитични" },
  { key: "meta", title: "Meta Pixel / Facebook Pixel", description: "Въведи Pixel ID от Meta Business. Зарежда се само при разрешени маркетинг бисквитки.", placeholder: "123456789012345", consent: "Маркетинг" },
  { key: "tiktok", title: "TikTok Pixel", description: "Въведи TikTok Pixel ID. Зарежда се само при разрешени маркетинг бисквитки.", placeholder: "ABCDE12345", consent: "Маркетинг" },
];

const eventLabels: Array<{ key: MarketingEventKey; title: string; description: string }> = [
  { key: "pageView", title: "Разглеждане на страница", description: "Изпраща PageView / page_view при смяна на страницата." },
  { key: "viewContent", title: "Разглеждане на продукт", description: "Подготвено за продуктова страница и ViewContent / view_item." },
  { key: "addToCart", title: "Добавяне в количка", description: "Изпраща AddToCart / add_to_cart при успешно добавяне." },
  { key: "initiateCheckout", title: "Започната поръчка", description: "Изпраща InitiateCheckout / begin_checkout при отваряне на checkout." },
  { key: "purchase", title: "Завършена поръчка", description: "Подготвено за Purchase / purchase след реално потвърдена поръчка." },
];

function isConfigured(provider: MarketingProviderSettings) {
  return provider.enabled && provider.id.trim().length > 0;
}

export default function MarketingIntegrationsManager({ initialIntegrations }: { initialIntegrations: MarketingIntegrationsStore }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateProvider(key: MarketingProviderKey, patch: Partial<MarketingProviderSettings>) {
    setIntegrations((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function updateEvent(key: MarketingEventKey, value: boolean) {
    setIntegrations((current) => ({ ...current, events: { ...current.events, [key]: value } }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/marketing-integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(integrations),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Интеграциите не бяха запазени.");
      return;
    }
    setIntegrations(result.integrations);
    setMessage("Маркетинг интеграциите са запазени.");
  }

  return <form className={styles.wrapper} onSubmit={save}>
    {message ? <div className={styles.message}>{message}</div> : null}

    <section className={styles.introCard}>
      <div>
        <span>Cookie controlled</span>
        <h2>Собственикът въвежда само ID-тата</h2>
        <p>Не се поставя ръчен JavaScript код. Сайтът сам зарежда правилните скриптове според съгласието за бисквитки.</p>
      </div>
      <button type="submit" disabled={saving}>{saving ? "Запазване..." : "Запази интеграциите"}</button>
    </section>

    <div className={styles.providersGrid}>
      {providerMeta.map((provider) => {
        const item = integrations[provider.key];
        const configured = isConfigured(item);
        return <section className={styles.providerCard} key={provider.key}>
          <div className={styles.cardHeader}>
            <div>
              <span>{provider.consent} cookies</span>
              <h2>{provider.title}</h2>
              <p>{provider.description}</p>
            </div>
            <b className={configured ? styles.statusOn : styles.statusOff}>{configured ? "Активна" : "Неактивна"}</b>
          </div>

          <label className={styles.switchLine}>
            <input type="checkbox" checked={item.enabled} onChange={(event) => updateProvider(provider.key, { enabled: event.target.checked })} />
            <span>Активирай интеграцията</span>
          </label>

          <label className={styles.field}>ID на интеграцията
            <input value={item.id} onChange={(event) => updateProvider(provider.key, { id: event.target.value })} placeholder={provider.placeholder} />
          </label>

          <label className={styles.switchLine}>
            <input type="checkbox" checked={item.testMode} onChange={(event) => updateProvider(provider.key, { testMode: event.target.checked })} />
            <span>Тестов режим — показва събитията в console, без да зарежда външен pixel</span>
          </label>
        </section>;
      })}
    </div>

    <section className={styles.eventsCard}>
      <div className={styles.cardHeader}>
        <div>
          <span>Събития</span>
          <h2>Какво да се проследява</h2>
          <p>Тези събития се изпращат само към активните интеграции и само ако клиентът е дал съответното cookie съгласие.</p>
        </div>
      </div>

      <div className={styles.eventsGrid}>
        {eventLabels.map((event) => <label className={styles.eventItem} key={event.key}>
          <input type="checkbox" checked={integrations.events[event.key]} onChange={(input) => updateEvent(event.key, input.target.checked)} />
          <span><strong>{event.title}</strong><small>{event.description}</small></span>
        </label>)}
      </div>
    </section>

    <div className={styles.bottomActions}>
      <button type="submit" disabled={saving}>{saving ? "Запазване..." : "Запази интеграциите"}</button>
    </div>
  </form>;
}
