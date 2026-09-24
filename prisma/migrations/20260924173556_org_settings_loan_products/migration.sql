-- CreateTable
CREATE TABLE "CooperativeSettings" (
    "id" TEXT NOT NULL,
    "orgName" TEXT NOT NULL DEFAULT 'Staff Cooperative',
    "logoUrl" TEXT,
    "currencySymbol" TEXT NOT NULL DEFAULT '₦',
    "loanEligibilityMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperativeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interestRate" DECIMAL(6,3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "repaymentType" "RepaymentType" NOT NULL DEFAULT 'FLAT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanProduct_isActive_idx" ON "LoanProduct"("isActive");
