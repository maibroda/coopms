-- CreateEnum
CREATE TYPE "RepaymentSource" AS ENUM ('PAYROLL', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentTarget" AS ENUM ('LOAN', 'SAVINGS');

-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LoanStatus" ADD VALUE 'PENDING';
ALTER TYPE "LoanStatus" ADD VALUE 'REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SaleStatus" ADD VALUE 'PENDING';
ALTER TYPE "SaleStatus" ADD VALUE 'REJECTED';

-- DropIndex
DROP INDEX "LoanRepayment_loanId_month_key";

-- DropIndex
DROP INDEX "ProductRepayment_saleId_month_key";

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedById" TEXT;

-- AlterTable
ALTER TABLE "LoanRepayment" ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "source" "RepaymentSource" NOT NULL DEFAULT 'PAYROLL';

-- AlterTable
ALTER TABLE "ProductRepayment" ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "ProductSale" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedById" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "target" "PaymentTarget" NOT NULL,
    "loanId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentClaim_memberId_idx" ON "PaymentClaim"("memberId");

-- CreateIndex
CREATE INDEX "PaymentClaim_status_idx" ON "PaymentClaim"("status");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_month_idx" ON "LoanRepayment"("loanId", "month");

-- CreateIndex
CREATE INDEX "ProductRepayment_saleId_month_idx" ON "ProductRepayment"("saleId", "month");

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
