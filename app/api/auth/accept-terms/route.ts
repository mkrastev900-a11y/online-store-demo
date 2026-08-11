import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION, verifyTermsToken } from "@/lib/terms";
import { isSameOriginRequest } from "@/lib/request-security";
import { createSessionToken, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error:"Невалидна заявка."},{status:403});
  const body = await request.json();
  const token = String(body.token ?? "");
  const accepted = body.accepted === true;
  const decoded = verifyTermsToken(token);
  if (!decoded || !accepted) return NextResponse.json({error:"Трябва да приемеш Общите условия, за да активираш профила."},{status:400});
  const user = await prisma.user.findUnique({where:{id:decoded.userId},select:{id:true,name:true,email:true,emailVerifiedAt:true,isActive:true}});
  if (!user?.emailVerifiedAt || !user.isActive) return NextResponse.json({error:"Профилът не може да бъде активиран."},{status:400});
  await prisma.user.update({where:{id:user.id},data:{termsAcceptedAt:new Date(),termsVersion:CURRENT_TERMS_VERSION,termsAcceptanceRequired:false,lastLoginAt:new Date()}});
  const session = await createSessionToken({userId:user.id,email:user.email,name:user.name});
  const response = NextResponse.json({accepted:true});
  response.cookies.set(sessionCookie.name,session,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:sessionCookie.maxAge});
  return response;
}
