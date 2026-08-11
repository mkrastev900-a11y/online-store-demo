CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "codeHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_expiresAt_idx" ON "EmailVerificationCode"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");
DO $$ BEGIN
  ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing credential accounts predate mandatory verification and remain usable.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "authProvider" = 'credentials' AND "emailVerifiedAt" IS NULL;
