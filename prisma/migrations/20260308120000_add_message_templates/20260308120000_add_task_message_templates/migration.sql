-- Add multiple message templates per task; backfill from legacy `message` column.

ALTER TABLE "Task" ADD COLUMN "messageTemplates" TEXT[];

UPDATE "Task" SET "messageTemplates" = ARRAY["message"]::TEXT[] WHERE "messageTemplates" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "messageTemplates" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "messageTemplates" SET DEFAULT ARRAY[]::TEXT[];
