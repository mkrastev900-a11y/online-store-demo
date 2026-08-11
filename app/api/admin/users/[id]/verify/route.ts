import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermissionApi } from "@/lib/admin-permissions";
import { writeAuditLog } from "@/lib/audit";

import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(_request)) return NextResponse.json({ error: "Невалиден източник на заявката." }, { status: 403 });
  const admin = await requireAdminPermissionApi("CUSTOMERS:EDIT");
  if (!admin) return NextResponse.json({ error: "Нямате право да потвърждавате потребители." }, { status: 403 });
  const { id } = await params; const userId=Number(id);
  if(!Number.isInteger(userId)) return NextResponse.json({error:"Невалиден потребител."},{status:400});
  const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,email:true,emailVerifiedAt:true,authProvider:true}});
  if(!user) return NextResponse.json({error:"Потребителят не е намерен."},{status:404});
  if(user.authProvider!=="credentials") return NextResponse.json({error:"Google профилите се потвърждават от Google."},{status:400});
  const verifiedAt=user.emailVerifiedAt??new Date();
  await prisma.$transaction([
    prisma.user.update({where:{id:userId},data:{emailVerifiedAt:verifiedAt,isActive:true}}),
    prisma.emailVerificationCode.updateMany({where:{userId,usedAt:null},data:{usedAt:new Date()}}),
  ]);
  await writeAuditLog({actorId:admin.id,action:"USER_EMAIL_MANUALLY_VERIFIED",entityType:"User",entityId:userId,description:`${admin.name} потвърди ръчно акаунта на ${user.name}.`,metadata:{email:user.email}});
  return NextResponse.json({ok:true,emailVerifiedAt:verifiedAt.toISOString()});
}
