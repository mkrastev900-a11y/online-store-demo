import { NextResponse } from "next/server";
import { getPublicSocialNetworks, readSocialNetworks } from "@/lib/social-networks-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { links: getPublicSocialNetworks(await readSocialNetworks()) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
