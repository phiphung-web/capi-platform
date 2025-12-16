-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Destination" ALTER COLUMN "healthStatus" SET DEFAULT 'UNKNOWN',
ALTER COLUMN "updatedAt" DROP DEFAULT;
