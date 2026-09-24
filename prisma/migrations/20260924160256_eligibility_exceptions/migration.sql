-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "exceptionReason" TEXT,
ADD COLUMN     "isExceptionRequest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductSale" ADD COLUMN     "exceptionReason" TEXT,
ADD COLUMN     "isExceptionRequest" BOOLEAN NOT NULL DEFAULT false;
