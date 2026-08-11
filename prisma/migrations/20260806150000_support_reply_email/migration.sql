ALTER TABLE "SupportTicketMessage"
  ADD COLUMN "emailSentAt" TIMESTAMP(3),
  ADD COLUMN "emailStatus" VARCHAR(20),
  ADD COLUMN "emailProviderId" VARCHAR(120);
