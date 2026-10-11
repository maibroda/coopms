
-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('DRAFT', 'APPROVED');

-- AlterTable
ALTER TABLE "CooperativeSettings" ADD COLUMN     "dividendRate" DECIMAL(5,4) NOT NULL DEFAULT 0.50,
ADD COLUMN     "dividendRepaymentRatio" DECIMAL(5,4) NOT NULL DEFAULT 0.40,
ADD COLUMN     "dividendSavingsRatio" DECIMAL(5,4) NOT NULL DEFAULT 0.60,
ADD COLUMN     "educationFundRate" DECIMAL(5,4) NOT NULL DEFAULT 0.025,
ADD COLUMN     "honorariumRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
ADD COLUMN     "meetingExpensesRate" DECIMAL(5,4) NOT NULL DEFAULT 0.175,
ADD COLUMN     "reserveFundRate" DECIMAL(5,4) NOT NULL DEFAULT 0.25;

-- CreateTable
CREATE TABLE "SurplusDeclaration" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "declaredSurplus" DECIMAL(14,2) NOT NULL,
    "reserveFundRate" DECIMAL(5,4) NOT NULL,
    "educationFundRate" DECIMAL(5,4) NOT NULL,
    "dividendRate" DECIMAL(5,4) NOT NULL,
    "honorariumRate" DECIMAL(5,4) NOT NULL,
    "meetingExpensesRate" DECIMAL(5,4) NOT NULL,
    "dividendSavingsRatio" DECIMAL(5,4) NOT NULL,
    "dividendRepaymentRatio" DECIMAL(5,4) NOT NULL,
    "reserveFundAmount" DECIMAL(14,2) NOT NULL,
    "educationFundAmount" DECIMAL(14,2) NOT NULL,
    "dividendAmount" DECIMAL(14,2) NOT NULL,
    "honorariumAmount" DECIMAL(14,2) NOT NULL,
    "meetingExpensesAmount" DECIMAL(14,2) NOT NULL,
    "dividendSavingsPool" DECIMAL(14,2) NOT NULL,
    "dividendRepaymentPool" DECIMAL(14,2) NOT NULL,
    "totalEligibleSavings" DECIMAL(14,2) NOT NULL,
    "totalEligibleRepayments" DECIMAL(14,2) NOT NULL,
    "unallocatedRepaymentPool" DECIMAL(14,2) NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "declaredById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurplusDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DividendAllocation" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "eligibleSavings" DECIMAL(14,2) NOT NULL,
    "eligibleRepayments" DECIMAL(14,2) NOT NULL,
    "savingsDividend" DECIMAL(14,2) NOT NULL,
    "repaymentDividend" DECIMAL(14,2) NOT NULL,
    "totalDividend" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurplusDeclaration_year_key" ON "SurplusDeclaration"("year");

-- CreateIndex
CREATE INDEX "SurplusDeclaration_status_idx" ON "SurplusDeclaration"("status");

-- CreateIndex
CREATE INDEX "DividendAllocation_declarationId_idx" ON "DividendAllocation"("declarationId");

-- CreateIndex
CREATE INDEX "DividendAllocation_memberId_idx" ON "DividendAllocation"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DividendAllocation_declarationId_memberId_key" ON "DividendAllocation"("declarationId", "memberId");

-- AddForeignKey
ALTER TABLE "DividendAllocation" ADD CONSTRAINT "DividendAllocation_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "SurplusDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendAllocation" ADD CONSTRAINT "DividendAllocation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

