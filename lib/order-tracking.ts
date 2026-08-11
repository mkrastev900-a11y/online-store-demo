export type PublicOrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type TrackingStepState = "completed" | "current" | "upcoming";

export const ORDER_TRACKING_STEPS = [
  { status: "PENDING", label: "Приета", description: "Получихме поръчката" },
  { status: "CONFIRMED", label: "Потвърдена", description: "Подготвяме артикулите" },
  { status: "SHIPPED", label: "Изпратена", description: "Предадена е на куриер" },
  { status: "DELIVERED", label: "Доставена", description: "Пратката е получена" },
] as const;

export const ORDER_STATUS_LABELS: Record<PublicOrderStatus, string> = {
  PENDING: "Нова поръчка",
  CONFIRMED: "Потвърдена",
  SHIPPED: "Изпратена",
  DELIVERED: "Доставена",
  CANCELLED: "Отказана",
};

export const ORDER_STATUS_MESSAGES: Record<PublicOrderStatus, string> = {
  PENDING: "Получихме поръчката и очакваме потвърждение.",
  CONFIRMED: "Поръчката е потвърдена и се подготвя за изпращане.",
  SHIPPED: "Пратката е предадена на куриера и пътува към теб.",
  DELIVERED: "Поръчката е доставена успешно.",
  CANCELLED: "Поръчката е отказана и няма да бъде изпратена.",
};

export function getOrderTrackingSteps(status: PublicOrderStatus) {
  if (status === "CANCELLED") {
    return ORDER_TRACKING_STEPS.map((step) => ({ ...step, state: "upcoming" as TrackingStepState }));
  }

  const currentIndex = ORDER_TRACKING_STEPS.findIndex((step) => step.status === status);
  return ORDER_TRACKING_STEPS.map((step, index) => ({
    ...step,
    state: (index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming") as TrackingStepState,
  }));
}

export function getLastActiveOrderStatus(
  status: PublicOrderStatus,
  dates: { confirmedAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null },
): Exclude<PublicOrderStatus, "CANCELLED"> {
  if (status !== "CANCELLED") return status;
  if (dates.deliveredAt) return "DELIVERED";
  if (dates.shippedAt) return "SHIPPED";
  if (dates.confirmedAt) return "CONFIRMED";
  return "PENDING";
}

export function getCourierTrackingPortal(provider: string | null) {
  if (provider === "ECONT") return { label: "Еконт", url: "https://www.econt.com/services/track-shipment" };
  if (provider === "SPEEDY") return { label: "Спиди", url: "https://www.speedy.bg/public/index.php/bg/track-shipment" };
  return null;
}

export function isDemoShipment(shipmentNumber: string | null) {
  return Boolean(shipmentNumber && shipmentNumber.toUpperCase().includes("DEMO"));
}

