import { NextResponse } from "next/server";
import { findPublicUserById } from "@/lib/auth-db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { user: null },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const user = await findPublicUserById(session.userId);

  if (!user) {
    return NextResponse.json(
      { user: null },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { user },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
