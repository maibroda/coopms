-- AlterTable: add nullable first so any existing rows can be backfilled
ALTER TABLE "BalanceImport" ADD COLUMN "asOfDate" DATE;

-- Backfill existing rows (if any) using the upload date itself as a reasonable default, since
-- the real "as of" period wasn't captured before this column existed.
UPDATE "BalanceImport" SET "asOfDate" = "createdAt"::date WHERE "asOfDate" IS NULL;

ALTER TABLE "BalanceImport" ALTER COLUMN "asOfDate" SET NOT NULL;
