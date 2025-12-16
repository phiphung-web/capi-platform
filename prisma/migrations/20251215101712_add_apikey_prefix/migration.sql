/*
  Warnings:

  - Added the required column `prefix` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
ALTER TABLE "ApiKey" ADD COLUMN "prefix" TEXT;

UPDATE "ApiKey"
SET "prefix" = SUBSTRING("key" FROM 1 FOR 8)
WHERE "prefix" IS NULL;

ALTER TABLE "ApiKey" ALTER COLUMN "prefix" SET NOT NULL;

