-- Google verifies the email address, but the store account remains unavailable
-- until the customer accepts the current Terms and Conditions.
UPDATE "User"
SET "termsAcceptanceRequired" = true
WHERE "authProvider" IN ('google', 'credentials_google')
  AND "termsAcceptedAt" IS NULL;
