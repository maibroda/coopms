-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "deferredInstallments" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LoanRepayment" ADD COLUMN     "penaltyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

