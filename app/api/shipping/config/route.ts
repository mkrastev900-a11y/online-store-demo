import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { shippingConfig } from "@/lib/shipping";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  return NextResponse.json(shippingConfig());
}
