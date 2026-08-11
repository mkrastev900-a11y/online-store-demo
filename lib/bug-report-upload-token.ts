import { SignJWT, jwtVerify } from "jose";

export type BugReportUploadClaims = {
  uploaderId: number;
  url: string;
  assetId: string;
  mimeType: string;
  fileSize: number;
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is required for QA upload tokens.");
  return new TextEncoder().encode(value);
}

export async function createBugReportUploadToken(claims: BugReportUploadClaims) {
  return new SignJWT({ ...claims, purpose: "bug-report-upload" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setJti(crypto.randomUUID())
    .sign(secret());
}

export async function verifyBugReportUploadToken(token: string, uploaderId: number) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.purpose !== "bug-report-upload" || payload.uploaderId !== uploaderId) throw new Error("INVALID_UPLOAD");
  if (typeof payload.url !== "string" || typeof payload.assetId !== "string" || typeof payload.mimeType !== "string" || typeof payload.fileSize !== "number") throw new Error("INVALID_UPLOAD");
  return {
    uploaderId,
    url: payload.url,
    assetId: payload.assetId,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
  } satisfies BugReportUploadClaims;
}
