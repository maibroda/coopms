-- CreateEnum
CREATE TYPE "BalanceCode" AS ENUM ('SAVINGS', 'LOAN');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "BalanceImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "membershipNumber" TEXT NOT NULL,
    "fullNameInFile" TEXT,
    "code" "BalanceCode" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "message" TEXT,

    CONSTRAINT "BalanceImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceImportRow_importId_idx" ON "BalanceImportRow"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "BalanceImportRow" ADD CONSTRAINT "BalanceImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BalanceImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
