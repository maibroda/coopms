-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('SOUTH_WEST', 'LAGOS', 'NORTH_CENTRAL', 'NORTH_EAST', 'SOUTH_SOUTH', 'SOUTH_EAST');

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('EMPLOYEE', 'EXTERNAL');

-- AlterTable: add new columns nullable first so existing rows can be backfilled
ALTER TABLE "Member"
  ADD COLUMN     "firstName" TEXT,
  ADD COLUMN     "middleName" TEXT,
  ADD COLUMN     "lastName" TEXT,
  ADD COLUMN     "gender" "Gender",
  ADD COLUMN     "houseAddress" TEXT,
  ADD COLUMN     "region" "Region",
  ADD COLUMN     "nextOfKinName" TEXT,
  ADD COLUMN     "nextOfKinAddress" TEXT,
  ADD COLUMN     "nextOfKinPhone" TEXT,
  ADD COLUMN     "memberType" "MemberType" NOT NULL DEFAULT 'EMPLOYEE';

-- Backfill firstName/middleName/lastName by splitting the existing fullName on whitespace.
-- Two-word names (the common case) split cleanly into first/last with no middle name; names
-- with three or more words keep the first and last word and fold everything between into
-- middleName. This is a best-effort split for pre-existing data — a later reseed/edit replaces
-- it with real recorded data.
UPDATE "Member" SET
  "firstName" = split_part("fullName", ' ', 1),
  "lastName" = CASE
    WHEN array_length(regexp_split_to_array("fullName", '\s+'), 1) >= 2
      THEN (regexp_split_to_array("fullName", '\s+'))[array_length(regexp_split_to_array("fullName", '\s+'), 1)]
    ELSE ''
  END,
  "middleName" = CASE
    WHEN array_length(regexp_split_to_array("fullName", '\s+'), 1) >= 3
      THEN array_to_string((regexp_split_to_array("fullName", '\s+'))[2:array_length(regexp_split_to_array("fullName", '\s+'), 1) - 1], ' ')
    ELSE NULL
  END;

-- Backfill the new required profile fields with placeholder values for pre-existing rows —
-- these are demo/transitional values only, overwritten by the next reseed or by editing each
-- member's record.
UPDATE "Member" SET
  "gender" = 'MALE',
  "houseAddress" = 'Not provided',
  "region" = 'LAGOS',
  "nextOfKinName" = 'Not provided',
  "nextOfKinAddress" = 'Not provided',
  "nextOfKinPhone" = 'Not provided'
WHERE "gender" IS NULL;

-- Now that every row has a value, enforce NOT NULL.
ALTER TABLE "Member"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL,
  ALTER COLUMN "gender" SET NOT NULL,
  ALTER COLUMN "houseAddress" SET NOT NULL,
  ALTER COLUMN "region" SET NOT NULL,
  ALTER COLUMN "nextOfKinName" SET NOT NULL,
  ALTER COLUMN "nextOfKinAddress" SET NOT NULL,
  ALTER COLUMN "nextOfKinPhone" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Member_region_idx" ON "Member"("region");
