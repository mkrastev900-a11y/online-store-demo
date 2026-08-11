import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  const normalized = value?.toUpperCase() ?? "";
  const isPlaceholder =
    normalized.startsWith("YOUR_") ||
    normalized.startsWith("REPLACE_") ||
    normalized.includes("EXAMPLE") ||
    normalized.includes("PLACEHOLDER");

  if (!value || isPlaceholder) {
    throw new Error(`${name} липсва или съдържа примерна стойност.`);
  }

  return value;
}

export function googleRedirectUri(requestUrl: string) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL("/api/auth/google/callback", requestUrl).toString();
}

export function googleClientConfig(requestUrl: string) {
  return {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: googleRedirectUri(requestUrl),
  };
}

export function safeOAuthNextPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = new URL("https://store.invalid");
    const resolved = new URL(value, base);
    return resolved.origin === base.origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function createOAuthState(next: string, source: "login" | "register" = "login") {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const safeNext = safeOAuthNextPath(next);
  return Buffer.from(JSON.stringify({ nonce, next: safeNext, source })).toString("base64url");
}

export function parseOAuthState(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { nonce?: unknown; next?: unknown; source?: unknown };
    const nonce = typeof parsed.nonce === "string" ? parsed.nonce : "";
    const next = safeOAuthNextPath(parsed.next);
    const source = parsed.source === "register" ? "register" : "login";
    return nonce ? { nonce, next, source } : null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(input: { code: string; requestUrl: string }) {
  const config = googleClientConfig(input.requestUrl);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  const payload = await response.json();
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("GOOGLE_TOKEN_FAILED");
  return payload.access_token as string;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await response.json();
  if (!response.ok || typeof profile.sub !== "string" || typeof profile.email !== "string") throw new Error("GOOGLE_PROFILE_FAILED");
  return { ...profile, email: profile.email.toLowerCase() };
}

export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const existingByGoogleId = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (existingByGoogleId) {
    return prisma.user.update({
      where: { id: existingByGoogleId.id },
      data: {
        lastLoginAt: new Date(),
        emailVerifiedAt: profile.email_verified ? new Date() : existingByGoogleId.emailVerifiedAt,
        termsAcceptanceRequired: existingByGoogleId.termsAcceptedAt ? existingByGoogleId.termsAcceptanceRequired : true,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        googleId: profile.sub,
        authProvider: existingByEmail.authProvider === "credentials" ? "credentials_google" : existingByEmail.authProvider,
        emailVerifiedAt: profile.email_verified ? new Date() : existingByEmail.emailVerifiedAt,
        lastLoginAt: new Date(),
        termsAcceptanceRequired: existingByEmail.termsAcceptedAt ? existingByEmail.termsAcceptanceRequired : true,
      },
    });
  }

  const name = (profile.name || `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() || profile.email.split("@")[0]).slice(0, 100);
  return prisma.user.create({
    data: {
      name,
      email: profile.email,
      googleId: profile.sub,
      authProvider: "google",
      emailVerifiedAt: profile.email_verified ? new Date() : null,
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 12),
      lastLoginAt: new Date(),
      termsAcceptanceRequired: true,
      cart: { create: {} },
    },
  });
}
