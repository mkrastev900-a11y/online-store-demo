import { NextResponse } from "next/server";
import {
  addFavorite,
  getFavoriteCount,
  getFavorites,
  removeFavorite,
} from "@/lib/favorites";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Трябва да влезеш в профила си." },
      { status: 401 },
    );
  }

  const summaryOnly =
    new URL(request.url).searchParams.get("summary") === "1";

  if (summaryOnly) {
    return NextResponse.json({
      count: await getFavoriteCount(session.userId),
    });
  }

  return NextResponse.json({ favorites: await getFavorites(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Трябва да влезеш в профила си." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const productId = Number(body.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Невалиден продукт." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      favorites: await addFavorite(session.userId, productId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Продуктът не беше добавен.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Трябва да влезеш в профила си." },
      { status: 401 },
    );
  }

  const productId = Number(
    new URL(request.url).searchParams.get("productId"),
  );

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json(
      { error: "Невалиден продукт." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    favorites: await removeFavorite(session.userId, productId),
  });
}
