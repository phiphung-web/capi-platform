-- Enable pgcrypto for sha256 hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Destination updates
ALTER TABLE "Destination" ADD COLUMN "adapterKey" TEXT;
ALTER TABLE "Destination" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Destination" ADD COLUMN "rulesetVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Destination" ADD COLUMN "deliveryPolicy" JSONB NOT NULL DEFAULT '{"maxAttempts":8,"baseBackoffSeconds":5,"maxBackoffSeconds":3600,"jitterRatio":0.2}';
ALTER TABLE "Destination" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;

UPDATE "Destination"
SET "adapterKey" = COALESCE("adapterKey", "type");

UPDATE "Destination"
SET "isEnabled" = "isActive"
WHERE "isEnabled" IS DISTINCT FROM "isActive";

ALTER TABLE "Destination" ALTER COLUMN "adapterKey" SET NOT NULL;

-- Event updates
ALTER TABLE "Event" ADD COLUMN "stage" TEXT;
ALTER TABLE "Event" ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN "clientEventId" TEXT;
ALTER TABLE "Event" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Event" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Event" ADD COLUMN "actorEmail" TEXT;
ALTER TABLE "Event" ADD COLUMN "actorPhone" TEXT;
ALTER TABLE "Event" ADD COLUMN "actorExternalId" TEXT;
ALTER TABLE "Event" ADD COLUMN "actorIp" TEXT;
ALTER TABLE "Event" ADD COLUMN "actorUserAgent" TEXT;
ALTER TABLE "Event" ADD COLUMN "objectType" TEXT;
ALTER TABLE "Event" ADD COLUMN "objectId" TEXT;
ALTER TABLE "Event" ADD COLUMN "valueAmount" DECIMAL(65,30);
ALTER TABLE "Event" ADD COLUMN "valueCurrency" TEXT;

UPDATE "Event"
SET "receivedAt" = COALESCE("receivedAt", "createdAt");

UPDATE "Event"
SET "occurredAt" = to_timestamp("eventTime")
WHERE "occurredAt" IS NULL AND "eventTime" IS NOT NULL;

UPDATE "Event"
SET "dedupeKey" = COALESCE("dedupeKey", 'legacy:' || encode(digest("projectId" || ':' || "id", 'sha256'), 'hex'))
WHERE "dedupeKey" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "Event_projectId_dedupeKey_key" ON "Event"("projectId", "dedupeKey");
CREATE INDEX "Event_projectId_occurredAt_idx" ON "Event"("projectId", "occurredAt");
CREATE INDEX "Event_projectId_stage_idx" ON "Event"("projectId", "stage");
CREATE INDEX "Event_projectId_eventName_idx" ON "Event"("projectId", "eventName");

-- DeliveryStatus enum
DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRYING', 'DEAD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- DestinationRule table
CREATE TABLE "DestinationRule" (
  "id" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "match" JSONB NOT NULL,
  "action" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DestinationRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DestinationRule" ADD CONSTRAINT "DestinationRule_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DestinationRule_destinationId_name_key" ON "DestinationRule"("destinationId", "name");
CREATE INDEX "DestinationRule_destinationId_isEnabled_priority_idx" ON "DestinationRule"("destinationId", "isEnabled", "priority");

-- StageDefinition table
CREATE TABLE "StageDefinition" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "inferenceRules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StageDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StageDefinition" ADD CONSTRAINT "StageDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StageDefinition_projectId_key_key" ON "StageDefinition"("projectId", "key");

-- DeliveryLog updates
ALTER TABLE "DeliveryLog" RENAME COLUMN "attempts" TO "attemptCount";
ALTER TABLE "DeliveryLog" RENAME COLUMN "lastResponse" TO "providerResponse";

ALTER TABLE "DeliveryLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeliveryLog" ALTER COLUMN "status" TYPE "DeliveryStatus" USING (
  CASE
    WHEN "status" IN ('pending', 'PENDING') THEN 'PENDING'::"DeliveryStatus"
    WHEN "status" IN ('processing', 'PROCESSING') THEN 'PROCESSING'::"DeliveryStatus"
    WHEN "status" IN ('success', 'SUCCESS') THEN 'SUCCESS'::"DeliveryStatus"
    WHEN "status" IN ('failed', 'FAILED') THEN 'FAILED'::"DeliveryStatus"
    WHEN "status" IN ('retrying', 'RETRYING') THEN 'RETRYING'::"DeliveryStatus"
    WHEN "status" IN ('dead', 'DEAD') THEN 'DEAD'::"DeliveryStatus"
    ELSE 'PENDING'::"DeliveryStatus"
  END
);
ALTER TABLE "DeliveryLog" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "DeliveryLog" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "DeliveryLog" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "DeliveryLog" ADD COLUMN "providerStatusCode" INTEGER;
ALTER TABLE "DeliveryLog" ADD COLUMN "processingLockId" TEXT;
ALTER TABLE "DeliveryLog" ADD COLUMN "processingLockedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryLog" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "DeliveryLog" ADD COLUMN "adapterKey" TEXT;
ALTER TABLE "DeliveryLog" ADD COLUMN "destinationRuleId" TEXT;
ALTER TABLE "DeliveryLog" ADD COLUMN "providerEventName" TEXT;
ALTER TABLE "DeliveryLog" ADD COLUMN "providerRequest" JSONB;
ALTER TABLE "DeliveryLog" ADD COLUMN "uniqueDeliveryKey" TEXT;

UPDATE "DeliveryLog" dl
SET "adapterKey" = d."adapterKey"
FROM "Destination" d
WHERE d.id = dl."destinationId";

UPDATE "DeliveryLog"
SET "uniqueDeliveryKey" = COALESCE("uniqueDeliveryKey", 'legacy:' || encode(digest("destinationId" || ':' || "eventId" || ':' || "id", 'sha256'), 'hex'))
WHERE "uniqueDeliveryKey" IS NULL;

ALTER TABLE "DeliveryLog" ALTER COLUMN "adapterKey" SET NOT NULL;
ALTER TABLE "DeliveryLog" ALTER COLUMN "uniqueDeliveryKey" SET NOT NULL;

ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_destinationRuleId_fkey" FOREIGN KEY ("destinationRuleId") REFERENCES "DestinationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DeliveryLog_uniqueDeliveryKey_key" ON "DeliveryLog"("uniqueDeliveryKey");
CREATE INDEX "DeliveryLog_status_nextAttemptAt_idx" ON "DeliveryLog"("status", "nextAttemptAt");
CREATE INDEX "DeliveryLog_destinationId_status_idx" ON "DeliveryLog"("destinationId", "status");
CREATE INDEX "DeliveryLog_eventId_idx" ON "DeliveryLog"("eventId");
