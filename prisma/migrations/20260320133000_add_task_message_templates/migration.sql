-- Add multi-template support for each task.
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "messageTemplates" TEXT[];

-- Backfill existing rows from legacy single message.
UPDATE "Task"
SET "messageTemplates" = ARRAY["message"]::TEXT[]
WHERE "messageTemplates" IS NULL
   OR cardinality("messageTemplates") = 0;

-- Enforce non-null with an empty-array default for new rows.
ALTER TABLE "Task"
ALTER COLUMN "messageTemplates" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "messageTemplates" SET NOT NULL;
