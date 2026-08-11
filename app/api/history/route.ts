import { NextResponse } from "next/server";
import {
  clearProductHistory,
  getProductHistory,
  recordProductView,
} from "@/lib/history";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Трябва да влезеш в профила си." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    history: await getProductHistory(session.userId),
  });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ saved: false });
  }

  const body = await request.json();
  const productId = Number(body.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json(
      { error: "Невалиден продукт." },
      { status: 400 },
    );
  }

  await recordProductView(session.userId, productId);

  return NextResponse.json({ saved: true });
}

export async function DELETE() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Трябва да влезеш в профила си." },
      { status: 401 },
    );
  }

  await clearProductHistory(session.userId);

  return NextResponse.json({ success: true });
}
