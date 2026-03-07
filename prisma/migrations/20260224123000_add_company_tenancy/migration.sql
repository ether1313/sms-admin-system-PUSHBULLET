-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- Seed 12 companies
INSERT INTO "Company" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  ('bybid9', 'bybid9', 'bybid9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ipay9', 'ipay9', 'ipay9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bp77', 'bp77', 'bp77', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kingbet9', 'kingbet9', 'kingbet9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('me99', 'me99', 'me99', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rolex9', 'rolex9', 'rolex9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gucci9', 'gucci9', 'gucci9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkm9', 'pkm9', 'pkm9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('winnie777', 'winnie777', 'winnie777', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('micky9', 'micky9', 'micky9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mrbean9', 'mrbean9', 'mrbean9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ace96au', 'ace96au', 'ace96au', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "companyId" TEXT;
ALTER TABLE "SenderMachine" ADD COLUMN "companyId" TEXT;

-- Fallback mapping for existing rows (safe if DB not empty)
UPDATE "Admin" SET "companyId" = 'bybid9' WHERE "companyId" IS NULL;
UPDATE "SenderMachine" SET "companyId" = 'bybid9' WHERE "companyId" IS NULL;

-- Ensure every company has SIM 1..SIM 10
INSERT INTO "SenderMachine" ("id", "name", "apiToken", "deviceIden", "createdAt", "updatedAt", "companyId")
SELECT
  ('sim-' || c."code" || '-' || gs.n::text) AS "id",
  ('SIM ' || gs.n::text) AS "name",
  '' AS "apiToken",
  '' AS "deviceIden",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt",
  c."id" AS "companyId"
FROM "Company" c
CROSS JOIN generate_series(1, 10) AS gs(n)
LEFT JOIN "SenderMachine" sm
  ON sm."companyId" = c."id"
 AND sm."name" = ('SIM ' || gs.n::text)
WHERE sm."id" IS NULL;

-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SenderMachine" ALTER COLUMN "companyId" SET NOT NULL;

-- Drop old senderMachine->admin relation
DROP INDEX IF EXISTS "SenderMachine_adminId_idx";
ALTER TABLE "SenderMachine" DROP CONSTRAINT IF EXISTS "SenderMachine_adminId_fkey";
ALTER TABLE "SenderMachine" DROP COLUMN IF EXISTS "adminId";

-- CreateIndex
CREATE UNIQUE INDEX "Admin_companyId_key" ON "Admin"("companyId");
CREATE INDEX "SenderMachine_companyId_idx" ON "SenderMachine"("companyId");
CREATE UNIQUE INDEX "SenderMachine_companyId_name_key" ON "SenderMachine"("companyId", "name");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SenderMachine" ADD CONSTRAINT "SenderMachine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
