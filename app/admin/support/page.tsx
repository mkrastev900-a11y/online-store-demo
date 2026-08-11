import {requireAdminPermission} from "@/lib/admin-permissions";
import {listAdminSupportTickets,listAssignableAdmins,SUPPORT_TOPIC_LABELS} from "@/lib/support-tickets";
import SupportTicketsPanel from "@/components/admin/SupportTicketsPanel";
import styles from "../admin.module.css";
export const dynamic="force-dynamic";
export default async function Page(){
  await requireAdminPermission("ORDERS:VIEW");
  const [rows,admins]=await Promise.all([listAdminSupportTickets(),listAssignableAdmins()]);
  const tickets=rows.map(t=>({...t,
    createdAt:t.createdAt.toISOString(),updatedAt:t.updatedAt.toISOString(),closedAt:t.closedAt?.toISOString()||null,
    lastCustomerMessageAt:t.lastCustomerMessageAt?.toISOString()||null,lastAdminMessageAt:t.lastAdminMessageAt?.toISOString()||null,adminReadAt:t.adminReadAt?.toISOString()||null,customerReadAt:t.customerReadAt?.toISOString()||null,
    order:t.order?{...t.order,total:Number(t.order.total),createdAt:t.order.createdAt.toISOString()}:null,
    messages:t.messages.map(m=>({...m,createdAt:m.createdAt.toISOString(),emailSentAt:m.emailSentAt?.toISOString()||null})),
    attachments:t.attachments.map(a=>({...a,createdAt:a.createdAt.toISOString()})),
    internalNotes:t.internalNotes.map(n=>({...n,createdAt:n.createdAt.toISOString()})),
    rmaRequest:t.rmaRequest?{...t.rmaRequest,refundAmount:t.rmaRequest.refundAmount===null?null:Number(t.rmaRequest.refundAmount),createdAt:t.rmaRequest.createdAt.toISOString(),updatedAt:t.rmaRequest.updatedAt.toISOString(),approvedAt:t.rmaRequest.approvedAt?.toISOString()||null,receivedAt:t.rmaRequest.receivedAt?.toISOString()||null,resolvedAt:t.rmaRequest.resolvedAt?.toISOString()||null,items:t.rmaRequest.items.map(item=>({...item,createdAt:item.createdAt.toISOString(),orderItem:{...item.orderItem,price:Number(item.orderItem.price)}}))}:null,
    topicLabel:SUPPORT_TOPIC_LABELS[t.topic]||t.topic
  }));
  return <main className={styles.main}><div className={styles.titleRow}><div><span>ОБСЛУЖВАНЕ НА КЛИЕНТИ</span><h1 style={{fontSize:"clamp(34px,4vw,54px)"}}>Чат и обслужване на клиенти</h1></div></div><SupportTicketsPanel initialTickets={tickets} admins={admins}/></main>
}
