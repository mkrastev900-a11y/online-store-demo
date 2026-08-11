/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import {NextResponse} from "next/server";
import {requireAdminPermissionApi} from "@/lib/admin-permissions";
import {prisma} from "@/lib/prisma";
import {sendSupportReplyEmail} from "@/lib/email";
import {isSameOriginRequest} from "@/lib/request-security";
import {deleteUploadedSupportFiles,validateAndUploadSupportFiles} from "@/lib/support-upload";

export const runtime="nodejs";
const VALID_STATUSES=["NEW","IN_PROGRESS","WAITING_CUSTOMER","CLOSED"] as const;
const VALID_PRIORITIES=["LOW","NORMAL","HIGH","URGENT"] as const;
const VALID_RMA_STATUSES=["REQUESTED","UNDER_REVIEW","APPROVED","PARTIALLY_APPROVED","REJECTED","AWAITING_RETURN","IN_TRANSIT","RECEIVED","REFUND_PENDING","REFUNDED","REPLACEMENT_SENT","CLOSED"] as const;
const VALID_RMA_RESOLUTIONS=["REFUND","EXCHANGE","REPLACEMENT","REPAIR","STORE_CREDIT","OTHER"] as const;

async function getTicket(id:number){return prisma.supportTicket.findUnique({where:{id},include:{user:{select:{name:true,email:true}},rmaRequest:{include:{items:{include:{orderItem:{select:{id:true,variantId:true,name:true,size:true,price:true}}}}}}}})}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Невалиден източник."},{status:403});
  const admin=await requireAdminPermissionApi("ORDERS:VIEW"); if(!admin)return NextResponse.json({error:"Нямаш достъп."},{status:403});
  const id=Number((await params).id); if(!Number.isInteger(id)||id<=0)return NextResponse.json({error:"Невалиден сигнал."},{status:400});
  try{
  const body=await request.json().catch(()=>({})); const action=String((body as {action?:string}).action||"update");
  const ticket=await getTicket(id); if(!ticket)return NextResponse.json({error:"Сигналът не е намерен."},{status:404});
  if(action==="markRead"){await prisma.supportTicket.update({where:{id},data:{adminReadAt:new Date()}});return NextResponse.json({ok:true});}
  if(action==="note"){
    const note=String((body as {note?:string}).note||"").trim();
    if(note.length<2||note.length>5000)return NextResponse.json({error:"Бележката трябва да е между 2 и 5000 знака."},{status:400});
    await prisma.supportTicketInternalNote.create({data:{ticketId:id,authorId:admin.id,body:note}});return NextResponse.json({ok:true});
  }
  if(action==="rma"){
    const rmaAdmin=await requireAdminPermissionApi("ORDERS:REFUND");
    if(!rmaAdmin)return NextResponse.json({error:"Нямаш право да обработваш рекламации и възстановявания."},{status:403});
    if(!ticket.rmaRequest)return NextResponse.json({error:"Този тикет няма RMA заявка."},{status:404});
    const status=String((body as {rmaStatus?:string}).rmaStatus||ticket.rmaRequest.status);
    const approvedResolutionRaw=(body as {approvedResolution?:unknown}).approvedResolution;
    const approvedResolution=approvedResolutionRaw===null||approvedResolutionRaw===""?null:String(approvedResolutionRaw||ticket.rmaRequest.approvedResolution||"");
    const adminDecision=String((body as {adminDecision?:string}).adminDecision??ticket.rmaRequest.adminDecision??"").trim();
    const tracking=String((body as {returnTrackingNumber?:string}).returnTrackingNumber??ticket.rmaRequest.returnTrackingNumber??"").trim();
    const refundRaw=(body as {refundAmount?:unknown}).refundAmount;
    const refundAmount=refundRaw===null||refundRaw===""?null:Number(refundRaw);
    if(!VALID_RMA_STATUSES.includes(status as never))return NextResponse.json({error:"Невалиден RMA статус."},{status:400});
    if(approvedResolution&&!VALID_RMA_RESOLUTIONS.includes(approvedResolution as never))return NextResponse.json({error:"Невалидно одобрено решение."},{status:400});
    if(adminDecision.length>5000)return NextResponse.json({error:"Решението е твърде дълго."},{status:400});
    if(tracking.length>120)return NextResponse.json({error:"Номерът за проследяване е твърде дълъг."},{status:400});
    if(refundAmount!==null&&(!Number.isFinite(refundAmount)||refundAmount<0))return NextResponse.json({error:"Невалидна сума за възстановяване."},{status:400});
    if(status==="REFUNDED"&&approvedResolution==="REFUND"){
      if(refundAmount===null||refundAmount<=0)return NextResponse.json({error:"За финализирано възстановяване въведи реално възстановената сума."},{status:400});
      const [order,previousRefunds]=await Promise.all([
        prisma.order.findUnique({where:{id:ticket.rmaRequest.orderId},select:{total:true}}),
        prisma.supportRmaRequest.aggregate({where:{orderId:ticket.rmaRequest.orderId,id:{not:ticket.rmaRequest.id},status:"REFUNDED",approvedResolution:"REFUND"},_sum:{refundAmount:true}}),
      ]);
      if(!order)return NextResponse.json({error:"Свързаната поръчка не е намерена."},{status:404});
      const alreadyRefunded=Number(previousRefunds._sum.refundAmount??0);
      const orderTotal=Number(order.total);
      if(alreadyRefunded+refundAmount>orderTotal+0.009)return NextResponse.json({error:`Общата възстановена сума не може да надвишава стойността на поръчката (${orderTotal.toFixed(2)} €). Вече възстановени: ${alreadyRefunded.toFixed(2)} €.`},{status:400});
    }
    const itemApprovals=Array.isArray((body as {itemApprovals?:unknown}).itemApprovals)?(body as {itemApprovals:any[]}).itemApprovals:[];
    if(approvedResolution==="REFUND"&&refundAmount!==null){
      const maxRefund=ticket.rmaRequest.items.reduce((sum,item)=>{
        const raw=itemApprovals.find(entry=>Number(entry?.id)===item.id);
        const quantity=raw&&Number.isInteger(Number(raw?.approvedQuantity))?Number(raw.approvedQuantity):(item.approvedQuantity??item.quantity);
        return sum+(Number(item.orderItem.price)*Math.max(0,Math.min(quantity,item.quantity)));
      },0);
      if(refundAmount>maxRefund+0.009)return NextResponse.json({error:`Сумата за възстановяване не може да надвишава стойността на одобрените артикули (${maxRefund.toFixed(2)} €).`},{status:400});
    }
    for(const raw of itemApprovals){
      const itemId=Number(raw?.id),qty=Number(raw?.approvedQuantity);
      const existing=ticket.rmaRequest.items.find(item=>item.id===itemId);
      if(existing&&Number.isInteger(qty)&&qty<existing.restockedQuantity)return NextResponse.json({error:`Не можеш да намалиш одобреното количество за ${existing.orderItem.name} под вече върнатите в наличност ${existing.restockedQuantity} бр.`},{status:400});
    }
    await prisma.$transaction(async tx=>{
      // Serialize all RMA mutations for one order so two admin requests cannot
      // double-restock or finalize refunds above the order total.
      const fresh=await tx.supportRmaRequest.findUnique({
        where:{id:ticket.rmaRequest!.id},
        include:{items:{include:{orderItem:{select:{id:true,variantId:true,name:true,size:true,price:true}}}}},
      });
      if(!fresh)throw new Error("RMA заявката вече не съществува.");

      if(status==="REFUNDED"&&approvedResolution==="REFUND"){
        if(refundAmount===null||refundAmount<=0)throw new Error("За финализирано възстановяване въведи реално възстановената сума.");
        const order=await tx.order.findUnique({where:{id:fresh.orderId},select:{total:true}});
        if(!order)throw new Error("Свързаната поръчка не е намерена.");
        const previousRefunds=await tx.supportRmaRequest.aggregate({
          where:{orderId:fresh.orderId,id:{not:fresh.id},status:"REFUNDED",approvedResolution:"REFUND"},
          _sum:{refundAmount:true},
        });
        const alreadyRefunded=Number(previousRefunds._sum.refundAmount??0);
        const orderTotal=Number(order.total);
        if(alreadyRefunded+refundAmount>orderTotal+0.009){
          throw new Error(`Общата възстановена сума не може да надвишава стойността на поръчката (${orderTotal.toFixed(2)} €). Вече възстановени: ${alreadyRefunded.toFixed(2)} €.`);
        }
      }

      for(const raw of itemApprovals){
        const itemId=Number(raw?.id),qty=Number(raw?.approvedQuantity);
        const existing=fresh.items.find(item=>item.id===itemId);
        if(!existing||!Number.isInteger(qty)||qty<0||qty>existing.quantity)continue;
        if(qty<existing.restockedQuantity)throw new Error(`Не можеш да намалиш одобреното количество за ${existing.orderItem.name} под вече върнатите в наличност ${existing.restockedQuantity} бр.`);
        await tx.supportRmaItem.update({where:{id:itemId},data:{approvedQuantity:qty}});
      }

      if(status==="RECEIVED"){
        for(const existing of fresh.items){
          const requested=itemApprovals.find(raw=>Number(raw?.id)===existing.id);
          const approved=requested?Number(requested?.approvedQuantity):(existing.approvedQuantity??existing.quantity);
          if(!Number.isInteger(approved)||approved<0||approved>existing.quantity)continue;
          const delta=approved-existing.restockedQuantity;
          if(delta<=0)continue;
          const variant=await tx.productVariant.findUnique({where:{id:existing.orderItem.variantId},select:{sold:true,productId:true}});
          if(!variant)continue;
          await tx.productVariant.update({
            where:{id:existing.orderItem.variantId},
            data:{stock:{increment:delta},sold:{decrement:Math.min(variant.sold,delta)}},
          });
          const aggregate=await tx.productVariant.aggregate({where:{productId:variant.productId,isActive:true},_sum:{stock:true}});
          await tx.product.update({where:{id:variant.productId},data:{stock:Math.max(0,aggregate._sum.stock??0)}});
          await tx.supportRmaItem.update({where:{id:existing.id},data:{restockedQuantity:{increment:delta}}});
        }
      }

      await tx.supportRmaRequest.update({
        where:{id:fresh.id},
        data:{
          status:status as never,
          approvedResolution:approvedResolution as never,
          adminDecision:adminDecision||null,
          returnTrackingNumber:tracking||null,
          refundAmount,
          approvedAt:["APPROVED","PARTIALLY_APPROVED"].includes(status)?(fresh.approvedAt||new Date()):fresh.approvedAt,
          receivedAt:status==="RECEIVED"?(fresh.receivedAt||new Date()):fresh.receivedAt,
          resolvedAt:["REFUNDED","REPLACEMENT_SENT","CLOSED","REJECTED"].includes(status)?(fresh.resolvedAt||new Date()):null,
        },
      });
      await tx.supportTicket.update({where:{id},data:{adminReadAt:new Date()}});
    });
    return NextResponse.json({ok:true});
  }
  const status=String((body as {status?:string}).status||ticket.status); const priority=String((body as {priority?:string}).priority||ticket.priority);
  const rawAssigned=(body as {assignedAdminId?:unknown}).assignedAdminId;
  const assignedAdminId = rawAssigned === undefined
    ? ticket.assignedAdminId
    : (rawAssigned === null || rawAssigned === "" ? null : Number(rawAssigned));
  if(!VALID_STATUSES.includes(status as never))return NextResponse.json({error:"Невалиден статус."},{status:400});
  if(!VALID_PRIORITIES.includes(priority as never))return NextResponse.json({error:"Невалиден приоритет."},{status:400});
  if(assignedAdminId!==null&&(!Number.isInteger(assignedAdminId)||assignedAdminId<=0))return NextResponse.json({error:"Невалиден администратор."},{status:400});
  if(assignedAdminId!==null){
    const assignee=await prisma.user.findUnique({where:{id:assignedAdminId},select:{role:true,isActive:true}});
    if(!assignee||!assignee.isActive||!["ADMIN","SUPER_ADMIN"].includes(assignee.role))return NextResponse.json({error:"Избраният служител няма активни администраторски права."},{status:400});
  }
  await prisma.supportTicket.update({where:{id},data:{status:status as never,priority:priority as never,assignedAdminId,closedAt:status==="CLOSED"?new Date():null,adminReadAt:new Date()}});
  return NextResponse.json({ok:true});
  }catch(error){
    console.error("[admin/support PATCH]", error);
    return NextResponse.json({error:error instanceof Error?error.message:"Промяната не беше записана."},{status:500});
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Невалиден източник."},{status:403});
  const admin=await requireAdminPermissionApi("ORDERS:VIEW"); if(!admin)return NextResponse.json({error:"Нямаш достъп."},{status:403});
  const id=Number((await params).id); if(!Number.isInteger(id)||id<=0)return NextResponse.json({error:"Невалиден сигнал."},{status:400});
  try{
    const data=await request.formData(); const message=String(data.get("message")||"").trim(); const sendEmail=String(data.get("sendEmail")||"")==="true";
    const files=data.getAll("files").filter((x):x is File=>x instanceof File&&x.size>0);
    if(message.length<2||message.length>5000)throw new Error("Отговорът трябва да е между 2 и 5000 знака.");
    const ticket=await getTicket(id); if(!ticket) return NextResponse.json({error:"Сигналът не е намерен."},{status:404});
    const uploaded=await validateAndUploadSupportFiles(files); const now=new Date();
    let created:{id:number};
    try {
      created=await prisma.$transaction(async tx=>{
        const msg=await tx.supportTicketMessage.create({data:{ticketId:id,authorId:admin.id,body:message,isAdmin:true,emailStatus:sendEmail?"PENDING":null}});
        if(uploaded.length)await tx.supportTicketAttachment.createMany({data:uploaded.map(file=>({ticketId:id,messageId:msg.id,...file}))});
        await tx.supportTicket.update({where:{id},data:{status:"WAITING_CUSTOMER",lastAdminMessageAt:now,adminReadAt:now}}); return msg;
      });
    } catch (error) {
      await deleteUploadedSupportFiles(uploaded);
      throw error;
    }
    let emailSent=false;
    if(sendEmail){
      const recipient=ticket.user?.email||ticket.guestEmail; const customerName=ticket.user?.name||ticket.guestName||"клиент";
      if(recipient){const result=await sendSupportReplyEmail({to:recipient,customerName,reference:ticket.reference,subject:ticket.subject,message});emailSent=result.sent;await prisma.supportTicketMessage.update({where:{id:created.id},data:{emailStatus:result.sent?"SENT":"FAILED",emailSentAt:result.sent?new Date():null,emailProviderId:result.sent?(result.id||null):null}})}
      else await prisma.supportTicketMessage.update({where:{id:created.id},data:{emailStatus:"FAILED"}});
    }
    return NextResponse.json({ok:true,emailSent});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Отговорът не беше изпратен."},{status:400});}
}
