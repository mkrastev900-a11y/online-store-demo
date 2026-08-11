import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isCourierProvider, listCourierOffices } from "@/lib/shipping";
import { checkRateLimit } from "@/lib/request-security";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  if (!(await checkRateLimit(`shipping-offices:${session.userId}`, { limit: 60, windowMs: 60 * 1000 })).allowed) {
    return NextResponse.json({ error: "Твърде много търсения. Опитай отново след минута." }, { status: 429 });
  }
  const params = new URL(request.url).searchParams;
  const provider = params.get("provider");
  const query = params.get("q")?.trim() || "";
  const city = params.get("city")?.trim() || "";
  if (!isCourierProvider(provider)) return NextResponse.json({ error: "Невалиден куриер." }, { status: 400 });
  if (`${query}${city}`.length < 2) return NextResponse.json({ offices: [] });
  try {
    return NextResponse.json({ offices: await listCourierOffices(provider, query, city) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Офисите не можаха да се заредят." }, { status: 503 });
  }
}
