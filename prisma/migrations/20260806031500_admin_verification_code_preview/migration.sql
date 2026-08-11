ALTER TABLE "EmailVerificationCode"
ADD COLUMN IF NOT EXISTS "codePlain" VARCHAR(6);
