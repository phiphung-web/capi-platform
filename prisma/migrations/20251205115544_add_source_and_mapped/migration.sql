/*
  Warnings:

  - You are about to drop the column `source` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "healthStatus" TEXT NOT NULL DEFAULT 'OK';

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "source",
ADD COLUMN     "qualityFlags" JSONB,
ADD COLUMN     "qualityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceTag" TEXT NOT NULL DEFAULT 'unknown';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "autoFixLevel" TEXT NOT NULL DEFAULT 'safe_defaults',
ADD COLUMN     "domain" TEXT;

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT,
    "mappingJson" JSONB,
    "seenFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_eventKey_key" ON "Source"("eventKey");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
