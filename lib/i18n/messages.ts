import type { AppLocale } from "./config";

type Messages = Record<string, string>;

const bg: Messages = {
  "common.language": "Език",
  "common.save": "Запази",
  "common.cancel": "Отказ",
  "common.delete": "Изтрий",
  "common.edit": "Редактирай",
  "common.create": "Създай",
  "common.search": "Търсене",
  "common.loading": "Зареждане…",
  "common.close": "Затвори",
  "common.yes": "Да",
  "common.no": "Не",
  "admin.panel": "АДМИНИСТРАТОРСКИ ПАНЕЛ",
  "admin.manageStore": "Управление на магазина",
  "admin.loggedAs": "Влязъл като",
  "admin.superAdmin": "Главен администратор",
  "admin.subAdmin": "Подадминистратор",
  "admin.openProfile": "Отвори профила",
  "admin.sections": "секции",
  "admin.unreadNews": "непрегледани новости",
  "nav.home": "Начало", "nav.women": "Дамско", "nav.men": "Мъжко", "nav.kids": "Детско", "nav.new": "Нови", "nav.sale": "Промоции", "nav.contact": "Контакти", "nav.about": "За нас", "nav.admin": "Админ",
  "adminNav.overview": "Табло", "adminNav.help": "Помощник", "adminNav.store": "Магазин", "adminNav.products": "Продукти", "adminNav.addProduct": "Добави продукт", "adminNav.attributes": "Стойности", "adminNav.marketingGroup": "Маркетинг", "adminNav.marketing": "Маркетинг интеграции", "adminNav.socialNetworks": "Социални мрежи", "adminNav.orders": "Поръчки", "adminNav.customerService": "Обслужване", "adminNav.support": "Запитвания и рекламации", "adminNav.customers": "Клиенти", "adminNav.inventory": "Наличности", "adminNav.promoCodes": "Промокодове", "adminNav.design": "Уеб дизайн", "adminNav.themeStudio": "Визуален редактор", "adminNav.system": "Система", "adminNav.health": "Системно здраве", "adminNav.admins": "Администратори", "adminNav.audit": "Дневник"
};

export const MESSAGES: Record<AppLocale, Messages> = { bg };
export type TranslationKey = keyof typeof bg;
