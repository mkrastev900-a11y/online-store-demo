import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { toSupportUnreadSummary } from "../lib/support-unread";

test("support unread summary normalizes compact badge counts", () => {
  assert.deepEqual(toSupportUnreadSummary({ unreadMessages: 3, unreadConversations: 2 }), {
    unreadMessages: 3,
    unreadConversations: 2,
  });
  assert.deepEqual(toSupportUnreadSummary({ unreadMessages: -4, unreadConversations: Number.NaN }), {
    unreadMessages: 0,
    unreadConversations: 0,
  });
});

test("support unread API derives customer identity from the server session", () => {
  const source = readFileSync("app/api/support/unread-summary/route.ts", "utf8");
  assert.match(source, /getSession\(\)/);
  assert.match(source, /getCustomerSupportUnreadSummary\(session\.userId\)/);
  assert.doesNotMatch(source, /searchParams/);
  assert.doesNotMatch(source, /request\.json/);
});

test("support unread query counts only unread admin messages for the current customer", () => {
  const source = readFileSync("lib/support-unread.server.ts", "utf8");
  assert.match(source, /t\."userId" = \$\{userId\}/);
  assert.match(source, /m\."isAdmin" = true/);
  assert.match(source, /m\."createdAt" > t\."customerReadAt"/);
  assert.match(source, /supportTicket\.findMany/);
  assert.doesNotMatch(source, /SELECT\s+\*/i);
  assert.doesNotMatch(source, /emailStatus|emailSentAt|emailProviderId/);
});

test("storefront support badge refreshes for every signed-in account with customer conversations", () => {
  const header = readFileSync("components/Header.tsx", "utf8");
  const css = readFileSync("components/Header.module.css", "utf8");
  const shell = readFileSync("components/StoreShell.tsx", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(header, /\/api\/support\/unread-summary/);
  assert.match(header, /const supportUnreadUserId = visibleUser\?\.id \?\? null/);
  assert.match(header, /const showMessageShortcut = Boolean\(visibleUser\)/);
  assert.match(header, /document\.visibilityState !== "hidden"/);
  assert.match(header, /15_000/);
  assert.match(header, /BroadcastChannel\(SUPPORT_UNREAD_BROADCAST_CHANNEL\)/);
  assert.match(header, /announceSupportUnreadUpdate\(summary\)/);
  assert.match(layout, /navigationItemsJson:\s*design\.navigationItemsJson/);
  assert.match(shell, /<Header initialSiteBrand=\{initialDesign\} initialUser=\{initialUser\}/);
  assert.match(header, /aria-label=\{navigationAriaLabel\(item\)\}/);
  assert.match(header, /data-unread=\{isContactNavigationItem\(item\.href\) && supportUnreadHasMessages/);
  assert.match(header, /href === "\/contact" \|\| href\.startsWith\("\/contact\?"\) \|\| href\.startsWith\("\/contact#"\)/);
  assert.match(header, /className=\{styles\.navUnreadBadge\} aria-live="polite"/);
  assert.match(header, /className=\{styles\.mobileNavUnreadBadge\} aria-live="polite"/);
  assert.match(css, /\.desktopNav a\[data-unread="true"\]/);
  assert.match(css, /\.desktopNav a\[data-unread="true"\][\s\S]*?background:\s*transparent/);
  assert.match(css, /\.desktopNav a\[data-unread="true"\]::before[\s\S]*?box-shadow:\s*inset/);
  assert.match(css, /\.mobileNav a\[data-unread="true"\]/);
});

test("contact page marks only the opened conversation as read and announces the new summary", () => {
  const contact = readFileSync("components/contact/ContactForm.tsx", "utf8");
  const contactRoute = readFileSync("app/api/contact/route.ts", "utf8");
  const ticketRoute = readFileSync("app/api/contact/[id]/route.ts", "utf8");
  const contactGet = contactRoute.match(/export async function GET\(\)[\s\S]*?export async function POST/)?.[0] || "";
  assert.match(contact, /customerUnreadMessages/);
  assert.match(contact, /data-unread=\{unreadCount > 0\}/);
  assert.match(contact, /function openTicket\(id: number\)/);
  assert.match(contact, /body: JSON\.stringify\(\{ action: "markRead" \}\)/);
  assert.match(contact, /announceSupportUnreadUpdate\(data\.summary\)/);
  assert.match(contact, /SUPPORT_UNREAD_UPDATED_EVENT/);
  assert.match(contact, /SUPPORT_UNREAD_BROADCAST_CHANNEL/);
  assert.match(contact, /setSelectedTicketId\(\(current\) =>/);
  assert.doesNotMatch(contact, /setSelectedTicketId\(preferred\?\.id \|\| selectedTicketId \|\|/);
  assert.doesNotMatch(contactGet, /customerReadAt\s*:/);
  assert.match(ticketRoute, /supportTicket\.findFirst\(\{where:\{id,userId:session\.userId\}/);
  assert.match(ticketRoute, /supportTicket\.update\(\{where:\{id\},data:\{customerReadAt:new Date\(\)\}\}/);
  assert.match(ticketRoute, /getCustomerSupportUnreadSummary\(session\.userId\)/);
});

test("admin replies create customer unread state without marking it read for the customer", () => {
  const source = readFileSync("app/api/admin/support/[id]/route.ts", "utf8");
  assert.match(source, /supportTicketMessage\.create\(\{data:\{ticketId:id,authorId:admin\.id,body:message,isAdmin:true/);
  assert.match(source, /lastAdminMessageAt:now/);
  assert.doesNotMatch(source, /customerReadAt:now/);
});

test("admin support nav and list expose static unread attention by message count", () => {
  const server = readFileSync("lib/admin-nav-alerts.server.ts", "utf8");
  const navCss = readFileSync("components/admin/AdminNav.module.css", "utf8");
  const panel = readFileSync("components/admin/SupportTicketsPanel.tsx", "utf8");
  const panelCss = readFileSync("components/admin/SupportTicketsPanel.module.css", "utf8");

  assert.match(server, /supportTicket\.findMany/);
  assert.match(server, /m\."isAdmin" = false/);
  assert.match(server, /m\."createdAt" > t\."adminReadAt"/);
  assert.match(server, /"\/admin\/support": Number\.isFinite\(unreadSupportMessages\)/);
  assert.match(navCss, /\.groupHasAlerts[\s\S]*background: linear-gradient/);
  assert.match(navCss, /\.standaloneLink\.hasAlerts,\s*\.subLink\.hasAlerts[\s\S]*background: linear-gradient/);
  assert.doesNotMatch(navCss, /adminAlertPulse|alertBadge[\s\S]{0,120}animation:/);
  assert.match(panel, /useState<number \| null>\(null\)/);
  assert.match(panel, /adminUnreadMessages\(item\)/);
  assert.match(panel, /data-unread=\{unreadCount > 0\}/);
  assert.match(panelCss, /\.ticket\[data-unread=true\]/);
  assert.match(panelCss, /\.unreadBadge/);
});
