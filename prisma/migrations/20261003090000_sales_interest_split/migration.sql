-- AlterTable
ALTER TABLE "ProductRepayment" ADD COLUMN     "interest" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "principal" DECIMAL(14,2) NOT NULL DEFAULT 0;

