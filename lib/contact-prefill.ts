export type ContactIdentityFields = {
  name: string;
  email: string;
  phone: string;
};

export type ContactOrderSummary = {
  id: number;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: number;
    name: string;
    size: string;
    quantity: number;
    price: number;
    product?: { imageUrl?: string | null; color?: string | null } | null;
  }>;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Нова",
  CONFIRMED: "Потвърдена",
  SHIPPED: "Изпратена",
  DELIVERED: "Доставена",
  CANCELLED: "Отказана",
};

export function applyContactProfile<T extends ContactIdentityFields>(
  current: T,
  profile: Partial<ContactIdentityFields> | null | undefined,
): T {
  if (!profile) return current;

  return {
    ...current,
    name: current.name.trim() || profile.name?.trim() || "",
    email: current.email.trim() || profile.email?.trim() || "",
    phone: current.phone.trim() || profile.phone?.trim() || "",
  };
}

export function formatContactOrderOption(order: ContactOrderSummary) {
  const date = new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Sofia",
  }).format(new Date(order.createdAt));
  const total = new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(order.total);
  const itemNames = order.items.map((item) => item.name).filter(Boolean);
  const products = itemNames.length ? ` · ${itemNames.join(", ")}` : "";

  return `${date} · ${total} · ${ORDER_STATUS_LABELS[order.status] || order.status}${products}`;
}
