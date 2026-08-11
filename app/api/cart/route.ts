import { NextResponse } from "next/server";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart";
import { getSession } from "@/lib/session";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function cartJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  });
}

function apiError(error: unknown, fallback = "Грешка.") {
  return cartJson(
    { error: error instanceof Error ? error.message : fallback },
    { status: 409 },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return cartJson({ error: "Влез в профила си." }, { status: 401 });
  }

  try {
    return cartJson(await getCart(session.userId));
  } catch (error) {
    return apiError(error, "Количката не можа да се зареди.");
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return cartJson({ error: "Влез в профила си." }, { status: 401 });
  }

  try {
    const body = await request.json();

    return cartJson(
      await addCartItem(
        session.userId,
        Number(body.productId),
        Number(body.variantId),
        Number(body.quantity ?? 1),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return cartJson({ error: "Влез в профила си." }, { status: 401 });
  }

  try {
    const body = await request.json();
    return cartJson(
      await updateCartItem(
        session.userId,
        Number(body.itemId),
        Number(body.quantity),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return cartJson({ error: "Влез в профила си." }, { status: 401 });
  }

  try {
    const itemId = Number(new URL(request.url).searchParams.get("itemId"));
    return cartJson(
      await removeCartItem(session.userId, itemId),
    );
  } catch (error) {
    return apiError(error);
  }
}
