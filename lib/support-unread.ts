export type SupportUnreadSummary = {
  unreadMessages: number;
  unreadConversations: number;
};

export type SupportUnreadUpdatedDetail = SupportUnreadSummary & {
  at: number;
  hasSummary: boolean;
};

export const SUPPORT_UNREAD_UPDATED_EVENT = "zlatevi-support-unread-updated";
export const SUPPORT_UNREAD_BROADCAST_CHANNEL = "zlatevi-support-unread";
export const SUPPORT_UNREAD_STORAGE_KEY = "zlatevi-support-unread-pulse";
export const EMPTY_SUPPORT_UNREAD_SUMMARY: SupportUnreadSummary = {
  unreadMessages: 0,
  unreadConversations: 0,
};

function safeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function toSupportUnreadSummary(value: unknown): SupportUnreadSummary {
  const data =
    value && typeof value === "object"
      ? (value as { unreadMessages?: unknown; unreadConversations?: unknown })
      : {};

  return {
    unreadMessages: safeCount(data.unreadMessages),
    unreadConversations: safeCount(data.unreadConversations),
  };
}

export function announceSupportUnreadUpdate(value?: unknown) {
  if (typeof window === "undefined") return;

  const hasSummary = value !== undefined;
  const detail: SupportUnreadUpdatedDetail = {
    ...(hasSummary
      ? toSupportUnreadSummary(value)
      : EMPTY_SUPPORT_UNREAD_SUMMARY),
    at: Date.now(),
    hasSummary,
  };

  window.dispatchEvent(
    new CustomEvent<SupportUnreadUpdatedDetail>(SUPPORT_UNREAD_UPDATED_EVENT, {
      detail,
    }),
  );

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(SUPPORT_UNREAD_BROADCAST_CHANNEL);
      channel.postMessage(detail);
      channel.close();
    }
  } catch {
    // Header polling remains the fallback when browser channels are unavailable.
  }

  try {
    window.localStorage.setItem(SUPPORT_UNREAD_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Storage can be blocked in privacy modes; focus/poll refresh still covers it.
  }
}
