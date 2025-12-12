-- Add updatedAt column safely for existing rows

ALTER TABLE "Destination" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "Destination"
SET "updatedAt" = NOW()
WHERE "updatedAt" IS NULL;

ALTER TABLE "Destination" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Destination" ALTER COLUMN "updatedAt" SET DEFAULT NOW();
