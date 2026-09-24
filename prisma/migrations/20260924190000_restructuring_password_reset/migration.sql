-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "restructuredFromLoanId" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_restructuredFromLoanId_key" ON "Loan"("restructuredFromLoanId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_restructuredFromLoanId_fkey" FOREIGN KEY ("restructuredFromLoanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

