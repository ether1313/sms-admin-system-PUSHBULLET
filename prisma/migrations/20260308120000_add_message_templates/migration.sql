-- Add multiple message templates per task; backfill from legacy `message` column.
DO $$
DECLARE col_data_type TEXT;
BEGIN
  SELECT data_type
  INTO col_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Task'
    AND column_name = 'messageTemplates';

  IF col_data_type IS NULL THEN
    ALTER TABLE "Task" ADD COLUMN "messageTemplates" TEXT[];
  ELSIF col_data_type <> 'ARRAY' THEN
    -- Legacy environments may have this column as JSON/JSONB; normalize to TEXT[].
    ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "messageTemplates_tmp" TEXT[] DEFAULT ARRAY[]::TEXT[];

    UPDATE "Task"
    SET "messageTemplates_tmp" = CASE
      WHEN "messageTemplates" IS NULL THEN ARRAY[]::TEXT[]
      WHEN jsonb_typeof("messageTemplates"::jsonb) = 'array'
        THEN COALESCE(
          (SELECT array_agg(value) FROM jsonb_array_elements_text("messageTemplates"::jsonb) AS value),
          ARRAY[]::TEXT[]
        )
      WHEN jsonb_typeof("messageTemplates"::jsonb) = 'string'
        THEN ARRAY["messageTemplates"::text]
      ELSE ARRAY[]::TEXT[]
    END;

    ALTER TABLE "Task" DROP COLUMN "messageTemplates";
    ALTER TABLE "Task" RENAME COLUMN "messageTemplates_tmp" TO "messageTemplates";
  END IF;
END $$;

UPDATE "Task"
SET "messageTemplates" = ARRAY["message"]::TEXT[]
WHERE "messageTemplates" IS NULL
   OR cardinality("messageTemplates") = 0;

ALTER TABLE "Task" ALTER COLUMN "messageTemplates" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "messageTemplates" SET DEFAULT ARRAY[]::TEXT[];
