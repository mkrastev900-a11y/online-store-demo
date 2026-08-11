import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "zlatevi_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET липсва или е прекалено кратък.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.sub);
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : "";

    if (!Number.isInteger(userId) || userId <= 0 || !email) {
      return null;
    }

    return { userId, email, name };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload) return null;

  const activeUser = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      email: payload.email.toLowerCase(),
      isActive: true,
    },
    select: { id: true },
  });

  return activeUser ? payload : null;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_DURATION_SECONDS,
};
