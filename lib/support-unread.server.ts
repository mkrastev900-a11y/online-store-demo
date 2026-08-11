import { prisma } from "@/lib/prisma";
import { EMPTY_SUPPORT_UNREAD_SUMMARY, toSupportUnreadSummary, type SupportUnreadSummary } from "@/lib/support-unread";

export async function getCustomerSupportUnreadSummary(userId: number): Promise<SupportUnreadSummary> {
  if (!Number.isInteger(userId) || userId <= 0) return EMPTY_SUPPORT_UNREAD_SUMMARY;
  const tickets = await prisma.supportTicket.findMany({
    where: { userId }, select: { id: true, customerReadAt: true, messages: { where: { isAdmin: true }, select: { createdAt: true } } }
  });
  let unreadMessages = 0; let unreadConversations = 0;
  for (const ticket of tickets) {
    const count = ticket.messages.filter((m) => !ticket.customerReadAt || m.createdAt > ticket.customerReadAt).length;
    unreadMessages += count; if (count) unreadConversations += 1;
  }
  return toSupportUnreadSummary({ unreadMessages, unreadConversations });
}

export async function getCustomerSupportUnreadCountsByTicket(userId: number): Promise<Map<number, number>> {
  if (!Number.isInteger(userId) || userId <= 0) return new Map();
  const tickets = await prisma.supportTicket.findMany({
    where: { userId }, select: { id: true, customerReadAt: true, messages: { where: { isAdmin: true }, select: { createdAt: true } } }
  });
  const result = new Map<number, number>();
  for (const ticket of tickets) {
    const count = ticket.messages.filter((m) => !ticket.customerReadAt || m.createdAt > ticket.customerReadAt).length;
    if (count) result.set(ticket.id, count);
  }
  return result;
}
