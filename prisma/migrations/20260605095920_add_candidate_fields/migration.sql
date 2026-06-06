-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "candidateFields" JSONB NOT NULL DEFAULT '[]';
