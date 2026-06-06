-- AlterTable
ALTER TABLE "voters" ADD COLUMN     "tokenLookup" TEXT;

-- CreateIndex
CREATE INDEX "voters_electionId_tokenLookup_idx" ON "voters"("electionId", "tokenLookup");
