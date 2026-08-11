"use client";

import { type FormEvent, useState } from "react";
import {
  SOCIAL_NETWORK_META,
  type SocialNetworkKey,
  type SocialNetworkLink,
  type SocialNetworksStore,
} from "@/lib/social-network-types";
import styles from "./SocialNetworksManager.module.css";

const networkKeys: SocialNetworkKey[] = ["facebook", "instagram", "tiktok"];

function SocialNetworkAdminIcon({ network }: { network: SocialNetworkKey }) {
  if (network === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.92 3.78-3.92 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.77l-.44 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
      </svg>
    );
  }
  if (network === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5.1" ry="5.1" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.2" cy="6.8" r="1.25" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.75 3c.36 2.94 2.05 4.72 5.02 4.91v3.35c-1.72.17-3.23-.39-4.93-1.43v6.28c0 7.98-8.7 10.48-12.2 4.75-2.25-3.68-.87-10.15 6.35-10.41v3.53c-.56.09-1.16.24-1.7.52-1.62.82-2.54 2.35-1.9 4.05 1.22 3.23 5.92 2.1 5.92-2.12V3h3.44Z" />
    </svg>
  );
}


function isActive(link: SocialNetworkLink) {
  return link.enabled && link.url.trim().length > 0;
}

export default function SocialNetworksManager({
  initialSocialNetworks,
}: {
  initialSocialNetworks: SocialNetworksStore;
}) {
  const [socialNetworks, setSocialNetworks] = useState(initialSocialNetworks);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateNetwork(key: SocialNetworkKey, patch: Partial<SocialNetworkLink>) {
    setSocialNetworks((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/social-networks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(socialNetworks),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setMessage(result.error || "Социалните мрежи не бяха запазени.");
      return;
    }

    setSocialNetworks(result.socialNetworks);
    setMessage("Социалните мрежи са запазени. Иконките в магазина са обновени.");
  }

  return (
    <form className={styles.wrapper} onSubmit={save}>
      {message ? <div className={styles.message}>{message}</div> : null}

      <section className={styles.introCard}>
        <div>
          <span>Горна лента</span>
          <h2>Преки пътища към профилите</h2>
          <p>
            Въведи линк, активирай социалната мрежа и иконката ще се появи в черната лента на магазина. Профилът ще се отваря в нов таб.
          </p>
        </div>
        <button type="submit" disabled={saving}>{saving ? "Запазване..." : "Запази социалните мрежи"}</button>
      </section>

      <div className={styles.cardsGrid}>
        {networkKeys.map((key) => {
          const meta = SOCIAL_NETWORK_META[key];
          const item = socialNetworks[key];
          const active = isActive(item);
          return (
            <section className={styles.networkCard} key={key}>
              <div className={styles.cardHeader}>
                <div className={styles.iconPreview} aria-hidden="true"><SocialNetworkAdminIcon network={key} /></div>
                <div>
                  <span>Профил / страница</span>
                  <h2>{meta.label}</h2>
                  <p>Иконката ще води директно към зададения линк.</p>
                </div>
                <b className={active ? styles.statusOn : styles.statusOff}>{active ? "Активна" : "Скрита"}</b>
              </div>

              <label className={styles.switchLine}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) => updateNetwork(key, { enabled: event.target.checked })}
                />
                <span>Покажи иконката в горната лента</span>
              </label>

              <label className={styles.field}>
                Линк към профил / страница
                <input
                  value={item.url}
                  onChange={(event) => updateNetwork(key, { url: event.target.value })}
                  placeholder={meta.placeholder}
                />
              </label>

              {item.url.trim() ? (
                <a className={styles.testLink} href={item.url} target="_blank" rel="noopener noreferrer">
                  Отвори линка за проверка ↗
                </a>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className={styles.bottomActions}>
        <button type="submit" disabled={saving}>{saving ? "Запазване..." : "Запази социалните мрежи"}</button>
      </div>
    </form>
  );
}
