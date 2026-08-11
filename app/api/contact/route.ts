import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { customerOwnsOrder, listContactOrderOptions } from "@/lib/customer-orders";
import { checkRateLimit, getClientIp, isSameOriginRequest, rateLimitHeaders } from "@/lib/request-security";
import { prisma } from "@/lib/prisma";
import { GUEST_SUPPORT_TOPICS, RMA_TOPICS, SUPPORT_TOPICS, SUPPORT_TOPIC_LABELS, makeRmaReference, makeTicketReference } from "@/lib/support-tickets";
import { deleteUploadedSupportFiles, validateAndUploadSupportFiles } from "@/lib/support-upload";
import { getCustomerSupportUnreadCountsByTicket } from "@/lib/support-unread.server";

export const runtime = "nodejs";
const RATE_LIMIT={limit:5,windowMs:15*60*1000};
function text(v:FormDataEntryValue|null){return typeof v==="string"?v.trim():""}

export async function GET(){
  const session=await getSession();
  if(!session) return NextResponse.json({authenticated:false,profile:null,orders:[]},{headers:{"Cache-Control":"no-store"}});
  const [profile,orders,tickets,unreadCounts]=await Promise.all([
    getProfile(session.userId),
    listContactOrderOptions(session.userId),
    prisma.supportTicket.findMany({where:{userId:session.userId},include:{messages:{orderBy:{createdAt:"asc"}},attachments:true,rmaRequest:{include:{items:{include:{orderItem:{select:{id:true,name:true,size:true,quantity:true,price:true}}},orderBy:{id:"asc"}}}}},orderBy:{updatedAt:"desc"},take:50}),
    getCustomerSupportUnreadCountsByTicket(session.userId),
  ]);
  const ticketsWithUnread=tickets.map((ticket)=>({...ticket,customerUnreadMessages:unreadCounts.get(ticket.id)||0}));
  return NextResponse.json({authenticated:true,profile:profile?{name:profile.name,email:profile.email,phone:profile.phone||""}:null,orders,tickets:ticketsWithUnread},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!isSameOriginRequest(request)) return NextResponse.json({error:"Невалиден източник на заявката."},{status:403});
  const limit=await checkRateLimit(`contact:${getClientIp(request)}`,RATE_LIMIT); const headers=rateLimitHeaders(limit);
  if(!limit.allowed) return NextResponse.json({error:"Изпрати твърде много съобщения. Опитай отново след малко."},{status:429,headers});
  try{
    const data=await request.formData();
    if(text(data.get("website"))) return NextResponse.json({message:"Сигналът е приет."},{status:201,headers});
    const session=await getSession();
    const name=text(data.get("name")),email=text(data.get("email")).toLowerCase(),message=text(data.get("message"));
    const topic=text(data.get("topic")); const orderId=Number(text(data.get("orderId"))||0);
    const requestedSubject=text(data.get("subject"));
    const subject=(requestedSubject || SUPPORT_TOPIC_LABELS[topic] || "Обслужване на клиенти").slice(0,180);
    const consent=text(data.get("consent"))==="true";
    const files=data.getAll("files").filter((x):x is File=>x instanceof File&&x.size>0);
    if(name.length<2||name.length>100) throw new Error("Въведи валидно име.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) throw new Error("Въведи валиден имейл.");
    if(subject.length<3||subject.length>180) throw new Error("Темата трябва да е между 3 и 180 знака.");
    if(message.length<10||message.length>5000) throw new Error("Съобщението трябва да е между 10 и 5000 знака.");
    if(!consent) throw new Error("Необходимо е съгласие за обработване на данните.");
    if(!SUPPORT_TOPICS.includes(topic as never)) throw new Error("Избери вид на запитването.");
    if(!session && !GUEST_SUPPORT_TOPICS.includes(topic as never)) throw new Error("За сигнали, рекламации и поръчки трябва да влезеш в профила си.");
    if(!session && files.length) throw new Error("Качването на файлове е достъпно само за влезли потребители.");
    if(session && orderId && !(await customerOwnsOrder(session.userId,orderId))) throw new Error("Избраната поръчка не принадлежи на профила ти.");
    if(["ORDER_QUESTION","DAMAGED_SHIPMENT","CLAIM","RETURN_REQUEST","WARRANTY"].includes(topic)&&!orderId) throw new Error("Избери поръчката, за която се отнася сигналът.");

    const isRma=RMA_TOPICS.includes(topic as never);
    let rmaInput:{orderItemId:number;quantity:number}[]=[];
    let rmaReason="",rmaResolution="",rmaNote="";
    if(isRma){
      if(!session) throw new Error("За връщане или рекламация трябва да влезеш в профила си.");
      try{
        const parsed=JSON.parse(text(data.get("rmaItems"))||"[]") as Array<{orderItemId?:unknown;quantity?:unknown}>;
        rmaInput=parsed.map(item=>({orderItemId:Number(item.orderItemId),quantity:Number(item.quantity)})).filter(item=>Number.isInteger(item.orderItemId)&&item.orderItemId>0&&Number.isInteger(item.quantity)&&item.quantity>0);
      }catch{throw new Error("Избраните артикули за връщане са невалидни.");}
      rmaReason=text(data.get("rmaReason"));
      rmaResolution=text(data.get("rmaResolution"));
      rmaNote=text(data.get("rmaNote"));
      const validReasons=["WRONG_SIZE","DEFECTIVE","DAMAGED_IN_TRANSIT","WRONG_ITEM","NOT_AS_DESCRIBED","CHANGED_MIND","OTHER"];
      const validResolutions=["REFUND","EXCHANGE","REPLACEMENT","REPAIR","STORE_CREDIT","OTHER"];
      if(!rmaInput.length) throw new Error("Избери поне един артикул и количество за връщане/рекламация.");
      if(!validReasons.includes(rmaReason)) throw new Error("Избери причина за връщането или рекламацията.");
      if(!validResolutions.includes(rmaResolution)) throw new Error("Избери желано решение.");
      if(rmaNote.length>2000) throw new Error("Допълнителното описание е твърде дълго.");
      const orderItems=await prisma.orderItem.findMany({where:{orderId,id:{in:rmaInput.map(item=>item.orderItemId)}},select:{id:true,quantity:true}});
      if(orderItems.length!==rmaInput.length) throw new Error("Един или повече избрани артикули не принадлежат на поръчката.");
      const qtyById=new Map(orderItems.map(item=>[item.id,item.quantity]));
      if(rmaInput.some(item=>item.quantity>(qtyById.get(item.orderItemId)||0))) throw new Error("Избраното количество е по-голямо от закупеното.");
      const alreadyRequested=await prisma.supportRmaItem.groupBy({by:["orderItemId"],where:{orderItemId:{in:rmaInput.map(item=>item.orderItemId)},request:{status:{not:"REJECTED"}}},_sum:{quantity:true}});
      const existingQty=new Map(alreadyRequested.map(item=>[item.orderItemId,item._sum.quantity||0]));
      if(rmaInput.some(item=>item.quantity+(existingQty.get(item.orderItemId)||0)>(qtyById.get(item.orderItemId)||0))) throw new Error("За един от артикулите вече има активна RMA заявка за част или за цялото закупено количество.");
    }

    const uploaded=await validateAndUploadSupportFiles(files);
    let reference=makeTicketReference();
    let rmaReference:string|null=null;
    let ticket:{id:number;reference:string};
    try {
      while(await prisma.supportTicket.findUnique({where:{reference},select:{id:true}})) reference=makeTicketReference();
      if(isRma){
        rmaReference=makeRmaReference();
        while(await prisma.supportRmaRequest.findUnique({where:{reference:rmaReference},select:{id:true}})) rmaReference=makeRmaReference();
      }
      const now=new Date();
      ticket=await prisma.$transaction(async tx=>{
        if(isRma&&session&&rmaReference){
          // Serialize RMA creation for the same order. The preliminary validation
          // above improves UX; this second check is the concurrency-safe guard.
          const freshOrderItems=await tx.orderItem.findMany({
            where:{orderId,id:{in:rmaInput.map(item=>item.orderItemId)}},
            select:{id:true,quantity:true},
          });
          if(freshOrderItems.length!==rmaInput.length)throw new Error("Един или повече избрани артикули вече не са налични в поръчката.");
          const freshQtyById=new Map(freshOrderItems.map(item=>[item.id,item.quantity]));
          const freshRequested=await tx.supportRmaItem.groupBy({
            by:["orderItemId"],
            where:{
              orderItemId:{in:rmaInput.map(item=>item.orderItemId)},
              request:{status:{not:"REJECTED"}},
            },
            _sum:{quantity:true},
          });
          const freshExistingQty=new Map(freshRequested.map(item=>[item.orderItemId,item._sum.quantity||0]));
          if(rmaInput.some(item=>item.quantity+(freshExistingQty.get(item.orderItemId)||0)>(freshQtyById.get(item.orderItemId)||0))){
            throw new Error("За един от артикулите вече е използвано цялото или част от закупеното количество в друга RMA заявка.");
          }
        }

        const created=await tx.supportTicket.create({data:{reference,userId:session?.userId,orderId:orderId||null,topic:topic as never,guestName:session?null:name,guestEmail:session?null:email,subject,lastCustomerMessageAt:now},select:{id:true,reference:true}});
        const firstMessage=await tx.supportTicketMessage.create({data:{ticketId:created.id,authorId:session?.userId,body:message,isAdmin:false}});
        if(uploaded.length)await tx.supportTicketAttachment.createMany({data:uploaded.map(file=>({ticketId:created.id,messageId:firstMessage.id,...file}))});
        if(isRma&&session&&rmaReference){
          await tx.supportRmaRequest.create({data:{reference:rmaReference,ticketId:created.id,userId:session.userId,orderId,reason:rmaReason as never,requestedResolution:rmaResolution as never,customerNote:rmaNote||null,items:{create:rmaInput.map(item=>({orderItemId:item.orderItemId,quantity:item.quantity}))}}});
        }
        return created;
      });
    } catch (error) {
      await deleteUploadedSupportFiles(uploaded);
      throw error;
    }
    return NextResponse.json({message:isRma?`Заявката е създадена. Тикет: ${ticket.reference} · RMA: ${rmaReference}`:`Получихме запитването ти. Референция: ${ticket.reference}`,reference:ticket.reference,rmaReference},{status:201,headers});
  }catch(error){console.error("Support ticket create error:",error);return NextResponse.json({error:error instanceof Error?error.message:"Сигналът не беше създаден."},{status:400,headers});}
}
