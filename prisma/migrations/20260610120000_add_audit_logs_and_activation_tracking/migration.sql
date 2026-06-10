-- Track whether an election has ever opened, and persist backend audit events.
ALTER TABLE "elections" ADD COLUMN "activatedAt" TIMESTAMP(3);

-- Existing ACTIVE/ENDED elections have already opened. Use updatedAt as the
-- best available historical approximation for the first-opened timestamp.
UPDATE "elections"
SET "activatedAt" = "updatedAt"
WHERE "status" IN ('ACTIVE', 'ENDED') AND "activatedAt" IS NULL;

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_electionId_idx" ON "audit_logs"("electionId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
