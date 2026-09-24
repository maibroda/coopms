-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TREASURER', 'MEMBER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RepaymentType" AS ENUM ('FLAT', 'REDUCING');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'RESTRUCTURED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('PHONE', 'LAPTOP', 'FOOD', 'APPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "membershipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "department" TEXT,
    "employeeNumber" TEXT,
    "dateJoined" TIMESTAMP(3) NOT NULL,
    "monthlyContribution" DECIMAL(14,2) NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "openingSavingsBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingLoanBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanAmount" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(6,3) NOT NULL,
    "repaymentType" "RepaymentType" NOT NULL DEFAULT 'FLAT',
    "durationMonths" INTEGER NOT NULL,
    "startMonth" DATE NOT NULL,
    "endMonth" DATE NOT NULL,
    "totalInterest" DECIMAL(14,2) NOT NULL,
    "totalRepayment" DECIMAL(14,2) NOT NULL,
    "monthlyRepayment" DECIMAL(14,2) NOT NULL,
    "outstandingBalance" DECIMAL(14,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedFrom" DATE,
    "suspendedUntil" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interest" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(6,3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "startMonth" DATE NOT NULL,
    "endMonth" DATE NOT NULL,
    "totalInterest" DECIMAL(14,2) NOT NULL,
    "totalRepayment" DECIMAL(14,2) NOT NULL,
    "monthlyDeduction" DECIMAL(14,2) NOT NULL,
    "outstandingBalance" DECIMAL(14,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRepayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionScheduleRun" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberCount" INTEGER NOT NULL,
    "totalSavings" DECIMAL(14,2) NOT NULL,
    "totalLoanRepayment" DECIMAL(14,2) NOT NULL,
    "totalDeduction" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "DeductionScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_membershipNumber_key" ON "Member"("membershipNumber");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE INDEX "Contribution_month_idx" ON "Contribution"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_memberId_month_key" ON "Contribution"("memberId", "month");

-- CreateIndex
CREATE INDEX "Loan_memberId_idx" ON "Loan"("memberId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "LoanRepayment_month_idx" ON "LoanRepayment"("month");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRepayment_loanId_month_key" ON "LoanRepayment"("loanId", "month");

-- CreateIndex
CREATE INDEX "ProductSale_memberId_idx" ON "ProductSale"("memberId");

-- CreateIndex
CREATE INDEX "ProductSale_status_idx" ON "ProductSale"("status");

-- CreateIndex
CREATE INDEX "ProductRepayment_month_idx" ON "ProductRepayment"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRepayment_saleId_month_key" ON "ProductRepayment"("saleId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionScheduleRun_month_key" ON "DeductionScheduleRun"("month");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRepayment" ADD CONSTRAINT "ProductRepayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ProductSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
