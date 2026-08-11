import { NextResponse } from "next/server";
import { getProfile, updateProfile, type ProfileInput } from "@/lib/profile";
import { createSessionToken, getSession, sessionCookie } from "@/lib/session";
import { hasOnlyDigits, isValidPhoneCharacters } from "@/lib/numeric-fields";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  }

  const profile = await getProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Профилът не е намерен." }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Трябва да влезеш в профила си." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<ProfileInput>;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Името е задължително." }, { status: 400 });
    }
    if (!isValidPhoneCharacters(body.phone) || !hasOnlyDigits(body.postalCode)) {
      return NextResponse.json({ error: "Телефонът или пощенският код съдържа непозволени знаци." }, { status: 400 });
    }

    const profile = await updateProfile(session.userId, {
      name: body.name,
      phone: body.phone || "",
      address: body.address || "",
      addressLine2: body.addressLine2 || "",
      city: body.city || "",
      postalCode: body.postalCode || "",
      country: body.country || "Bulgaria",
    });

    const response = NextResponse.json(profile);
    const token = await createSessionToken({
      userId: session.userId,
      email: session.email,
      name: profile.name,
    });
    response.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Профилът не можа да бъде запазен." }, { status: 500 });
  }
}
