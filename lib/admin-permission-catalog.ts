export const ADMIN_SECTIONS = [
  { key: "DASHBOARD", label: "Табло", actions: ["VIEW"] },
  { key: "ADMINISTRATORS", label: "Администратори и права", actions: ["VIEW", "MANAGE"] },
  { key: "AUDIT_LOG", label: "Дневник на действията", actions: ["VIEW"] },
  { key: "PRODUCTS", label: "Продукти", actions: ["VIEW", "CREATE", "EDIT", "DELETE", "IMPORT", "EXPORT"] },
  { key: "ORDERS", label: "Поръчки", actions: ["VIEW", "CONFIRM", "SHIP", "DELIVER", "CANCEL", "REFUND"] },
  { key: "INVENTORY", label: "Наличности", actions: ["VIEW", "ADJUST", "HISTORY", "SETTINGS"] },
  { key: "ACCOUNTING", label: "Вътрешно счетоводство", actions: ["VIEW", "EXPORT"] },
  { key: "CUSTOMERS", label: "Клиенти", actions: ["VIEW", "EDIT", "STATUS", "NOTES", "TAGS", "BLOCK", "EXPORT"] },
  { key: "SYSTEM_HEALTH", label: "Системно здраве", actions: ["VIEW"] },
  { key: "LEGAL_SETTINGS", label: "Общи условия и фирмени детайли", actions: ["VIEW", "EDIT"] },
  { key: "WEB_DESIGN", label: "Уеб дизайн", actions: ["VIEW", "EDIT", "PUBLISH", "ASSETS", "RESTORE"] },
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]["key"];
export type LegacyInternalPermissionKey =
  | `PAGE_BUILDER:${string}`
  | `CMS:${string}`;

export type AdminPermissionKey = `${AdminSectionKey}:${string}` | LegacyInternalPermissionKey;

export const ACTION_LABELS: Record<string, string> = {
  VIEW: "Преглед", CREATE: "Създаване", EDIT: "Редакция", DELETE: "Изтриване",
  IMPORT: "Импорт", EXPORT: "Експорт", CONFIRM: "Потвърждаване", SHIP: "Изпращане",
  CANCEL: "Отказ / анулиране", REFUND: "Възстановяване", ADJUST: "Корекция",
  STOCKTAKE: "Инвентаризация", TRANSFER: "Трансфер", APPROVE: "Одобряване / изпращане", POST: "Осчетоводяване",
  ISSUE: "Издаване", PRINT: "Печат / PDF", RECEIVE: "Приемане", BUDGET: "Бюджетиране", ASSIGN: "Възлагане", COMMENT: "Коментари", MANAGE: "Управление", RUN: "Изпълнение", SCHEDULE: "Планиране", HISTORY: "История", BATCHES: "Партиди и срокове", SERIALS: "Серийни номера", COUNT: "Инвентаризации", APPROVE_COUNT: "Одобряване на инвентаризация", LABELS: "Баркодове и QR етикети", MOBILE: "Мобилен склад и скенер", REPLENISHMENT: "Умно зареждане", PICK: "Комплектоване", PACK: "Опаковане", DELIVER: "Отбелязване като доставена", CLOSE: "Приключване", SETTINGS: "Настройки", SCRAP: "Бракуване", STATUS: "CRM статус", NOTES: "Бележки", TAGS: "Тагове", BLOCK: "Блокиране / активиране", VIEW_ALL: "Преглед на всички", RESOLVE: "Маркиране като поправено", RETEST: "Повторен тест", REOPEN: "Повторно отваряне", CREATE_TASK: "Създаване на задача", VIEW_DIAGNOSTICS: "Технически данни", MANAGE_SETTINGS: "Настройки на модула", PUBLISH: "Публикуване", ASSETS: "Качване на файлове", RESTORE: "Възстановяване на версия", LOCK_PERIOD: "Заключване на период", UNLOCK_PERIOD: "Отключване на период",
};

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissionKey[] = [
  "DASHBOARD:VIEW", "PRODUCTS:VIEW", "ORDERS:VIEW", "INVENTORY:VIEW", "CUSTOMERS:VIEW",
];

export function isValidPermission(section: string, action: string) {
  const found = ADMIN_SECTIONS.find((item) => item.key === section);
  return Boolean(found && (found.actions as readonly string[]).includes(action));
}
