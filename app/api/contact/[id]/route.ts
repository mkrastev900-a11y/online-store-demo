import {NextResponse} from "next/server";
import {getSession} from "@/lib/session";
import {prisma} from "@/lib/prisma";
import {isSameOriginRequest} from "@/lib/request-security";
import {deleteUploadedSupportFiles,validateAndUploadSupportFiles} from "@/lib/support-upload";
import {getCustomerSupportUnreadSummary} from "@/lib/support-unread.server";

export const runtime="nodejs";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Невалиден източник."},{status:403});
 const session=await getSession();if(!session)return NextResponse.json({error:"Влез в профила си."},{status:401});
 const id=Number((await params).id); const body=await request.json().catch(()=>({}));
 const ticket=await prisma.supportTicket.findFirst({where:{id,userId:session.userId},select:{id:true}});
 if(!ticket)return NextResponse.json({error:"Сигналът не е намерен."},{status:404});
 if(String((body as {action?:string}).action||"")==="markRead"){
   await prisma.supportTicket.update({where:{id},data:{customerReadAt:new Date()}});
   const summary=await getCustomerSupportUnreadSummary(session.userId);
   return NextResponse.json({ok:true,summary});
 }
 return NextResponse.json({error:"Невалидна операция."},{status:400});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Невалиден източник."},{status:403});
 const session=await getSession();if(!session)return NextResponse.json({error:"Влез в профила си."},{status:401});
 const id=Number((await params).id); if(!Number.isInteger(id)||id<=0)return NextResponse.json({error:"Невалиден сигнал."},{status:400});
 try{
   const data=await request.formData(); const message=String(data.get("message")||"").trim();
   const files=data.getAll("files").filter((x):x is File=>x instanceof File&&x.size>0);
   if(message.length<2||message.length>5000)return NextResponse.json({error:"Съобщението трябва да е между 2 и 5000 знака."},{status:400});
   const ticket=await prisma.supportTicket.findFirst({where:{id,userId:session.userId},select:{id:true,status:true}});
   if(!ticket)return NextResponse.json({error:"Сигналът не е намерен."},{status:404});
   if(ticket.status==="CLOSED")return NextResponse.json({error:"Приключен сигнал не може да бъде допълван."},{status:409});
   const uploaded=await validateAndUploadSupportFiles(files); const now=new Date();
   try {
     await prisma.$transaction(async tx=>{
       const freshTicket=await tx.supportTicket.findFirst({where:{id,userId:session.userId},select:{status:true}});
       if(!freshTicket)throw new Error("Сигналът не е намерен.");
       if(freshTicket.status==="CLOSED")throw new Error("Приключен сигнал не може да бъде допълван.");
       const created=await tx.supportTicketMessage.create({data:{ticketId:id,authorId:session.userId,body:message,isAdmin:false}});
       if(uploaded.length)await tx.supportTicketAttachment.createMany({data:uploaded.map(file=>({ticketId:id,messageId:created.id,...file}))});
       await tx.supportTicket.update({where:{id},data:{status:"IN_PROGRESS",lastCustomerMessageAt:now,customerReadAt:now}});
     });
   } catch (error) {
     await deleteUploadedSupportFiles(uploaded);
     throw error;
   }
   const summary=await getCustomerSupportUnreadSummary(session.userId);
   return NextResponse.json({ok:true,summary});
 }catch(error){
   const message=error instanceof Error?error.message:"Отговорът не беше изпратен.";
   const status=message==="Сигналът не е намерен."?404:message==="Приключен сигнал не може да бъде допълван."?409:400;
   return NextResponse.json({error:message},{status});
 }
}
