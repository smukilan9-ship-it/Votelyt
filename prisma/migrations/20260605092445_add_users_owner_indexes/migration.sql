/*
  Warnings:

  - Added the required column `ownerId` to the `elections` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "allowAbstain" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "candidates_electionId_idx" ON "candidates"("electionId");

-- CreateIndex
CREATE INDEX "candidates_positionId_idx" ON "candidates"("positionId");

-- CreateIndex
CREATE INDEX "elections_ownerId_idx" ON "elections"("ownerId");

-- CreateIndex
CREATE INDEX "elections_status_idx" ON "elections"("status");

-- CreateIndex
CREATE INDEX "positions_electionId_idx" ON "positions"("electionId");

-- CreateIndex
CREATE INDEX "voter_field_defs_electionId_idx" ON "voter_field_defs"("electionId");

-- CreateIndex
CREATE INDEX "voters_electionId_idx" ON "voters"("electionId");

-- CreateIndex
CREATE INDEX "voters_electionId_hasVoted_idx" ON "voters"("electionId", "hasVoted");

-- CreateIndex
CREATE INDEX "votes_electionId_idx" ON "votes"("electionId");

-- CreateIndex
CREATE INDEX "votes_positionId_idx" ON "votes"("positionId");

-- CreateIndex
CREATE INDEX "votes_candidateId_idx" ON "votes"("candidateId");

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
