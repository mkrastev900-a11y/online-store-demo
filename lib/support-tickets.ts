import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const SUPPORT_TOPICS = ["GENERAL","OTHER","ORDER_QUESTION","DAMAGED_SHIPMENT","CLAIM","RETURN_REQUEST","WARRANTY"] as const;
export const GUEST_SUPPORT_TOPICS = ["GENERAL","OTHER"] as const;
export const RMA_TOPICS = ["DAMAGED_SHIPMENT","CLAIM","RETURN_REQUEST","WARRANTY"] as const;
export const RMA_STATUS_LABELS: Record<string,string> = {
  REQUESTED:"Заявено", UNDER_REVIEW:"В преглед", APPROVED:"Одобрено", PARTIALLY_APPROVED:"Частично одобрено",
  REJECTED:"Отказано", AWAITING_RETURN:"Очаква връщане", IN_TRANSIT:"Пътува към нас", RECEIVED:"Получено",
  REFUND_PENDING:"Очаква възстановяване", REFUNDED:"Сумата е възстановена", REPLACEMENT_SENT:"Замяната е изпратена", CLOSED:"Приключено",
};
export const RMA_REASON_LABELS: Record<string,string> = {
  WRONG_SIZE:"Неподходящ размер", DEFECTIVE:"Дефект", DAMAGED_IN_TRANSIT:"Повредено при доставка", WRONG_ITEM:"Получен грешен артикул",
  NOT_AS_DESCRIBED:"Не отговаря на описанието", CHANGED_MIND:"Отказ от покупката", OTHER:"Друга причина",
};
export const RMA_RESOLUTION_LABELS: Record<string,string> = {
  REFUND:"Възстановяване на сума", EXCHANGE:"Замяна на размер/вариант", REPLACEMENT:"Замяна с нов продукт", REPAIR:"Ремонт", STORE_CREDIT:"Кредит в магазина", OTHER:"Друго решение",
};
export function makeRmaReference(){
  const day=new Date().toISOString().slice(0,10).replaceAll("-","");
  return `RMA-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export const SUPPORT_TOPIC_LABELS: Record<string,string> = {
  GENERAL:"Общо запитване", OTHER:"Друго", ORDER_QUESTION:"Въпрос за поръчка",
  DAMAGED_SHIPMENT:"Нарушена пратка", CLAIM:"Рекламация", RETURN_REQUEST:"Връщане на продукт", WARRANTY:"Гаранция",
};
export function makeTicketReference(){
  const day=new Date().toISOString().slice(0,10).replaceAll("-","");
  return `REQ-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
export async function listAdminSupportTickets(){
  return prisma.supportTicket.findMany({
    include:{
      user:{select:{id:true,name:true,email:true,phone:true}},
      order:{select:{id:true,createdAt:true,total:true,status:true,items:{select:{id:true,name:true,size:true,quantity:true}}}},
      assignedAdmin:{select:{id:true,name:true,email:true}},
      messages:{orderBy:{createdAt:"asc"}},
      attachments:true,
      internalNotes:{include:{author:{select:{id:true,name:true,email:true}}},orderBy:{createdAt:"asc"}},
      rmaRequest:{include:{items:{include:{orderItem:{select:{id:true,name:true,size:true,quantity:true,price:true}}},orderBy:{id:"asc"}}}},
    },
    orderBy:[{priority:"desc"},{updatedAt:"desc"}],take:300,
  });
}

export async function listAssignableAdmins(){
  return prisma.user.findMany({
    where:{role:{in:["ADMIN","SUPER_ADMIN"]},isActive:true},
    select:{id:true,name:true,email:true},
    orderBy:{name:"asc"},
  });
}
