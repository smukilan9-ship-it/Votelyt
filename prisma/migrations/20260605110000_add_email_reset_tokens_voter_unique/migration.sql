-- Additive, non-destructive migration.
-- Adds: User.email (nullable, unique), User.tokenVersion, password_reset_tokens
-- table, and upgrades the (electionId, tokenLookup) index to a UNIQUE constraint
-- to guarantee no duplicate access codes. No columns/tables are dropped and no
-- existing rows are modified.

-- AlterTable: User
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- Upgrade the plain (electionId, tokenLookup) index to UNIQUE.
DROP INDEX "voters_electionId_tokenLookup_idx";
CREATE UNIQUE INDEX "voters_electionId_tokenLookup_key" ON "voters"("electionId", "tokenLookup");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
