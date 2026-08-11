import { NextResponse } from "next/server";
import { getSiteDesign } from "@/lib/site-design";
export async function GET(){ return NextResponse.json(await getSiteDesign()); }
