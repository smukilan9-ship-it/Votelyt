-- CreateEnum
CREATE TYPE "AuthMode" AS ENUM ('ACCESS_CODE', 'TWO_FIELDS');

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "authFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "authMode" "AuthMode" NOT NULL DEFAULT 'ACCESS_CODE';

-- AlterTable
ALTER TABLE "voters" ALTER COLUMN "tokenHash" DROP NOT NULL;
