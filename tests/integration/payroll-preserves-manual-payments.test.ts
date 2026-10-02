import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, recordManualLoanRepayment } from "@/lib/services/loans";
import { postSchedule } from "@/lib/services/schedule";
import { num } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

/**
 * Regression test for a real bug found by audit: postSchedule used to reset a loan's
 * outstandingBalance to whatever the ORIGINAL fixed amortization schedule said at the new
 * installment-count index, discarding any manual repayment, admin correction or early-payoff
 * rebate applied since. The next payroll run must instead decrement the loan's CURRENT balance.
 */
describe("payroll preserves manual repayments instead of resetting the balance", () => {
  let ctx: Ctx;
  let loanId: string;

  beforeAll(async () => {
    await db.$transaction([
      db.paymentClaim.deleteMany(),
      db.auditLog.deleteMany(),
      db.cooperativeSettings.deleteMany(),
      db.deductionScheduleRun.deleteMany(),
      db.loanRepayment.deleteMany(),
      db.productRepayment.deleteMany(),
      db.loan.deleteMany(),
      db.productSale.deleteMany(),
      db.contribution.deleteMany(),
      db.user.deleteMany(),
      db.member.deleteMany(),
    ]);
    const admin = await createUser({ email: "payroll-manual-admin@test.local", password: "Password123!", name: "Payroll Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
    const member = await createMember(ctx, {
      firstName: "Payroll",
      lastName: "Manual Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: "2020-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 500000,
    });

    // ₦60,000 @ 10% flat / 6 months = ₦6,000 interest, ₦66,000 total, ₦11,000/month installment.
    const loan = await createLoan(ctx, {
      memberId: member.id,
      loanAmount: 60000,
      interestRate: 10,
      durationMonths: 6,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    loanId = loan.id;

    await postSchedule(ctx, new Date("2026-01-01")); // balance: 66,000 - 11,000 = 55,000

    // A manual overpayment of 20,000 (nearly double a normal installment) before February payroll.
    await recordManualLoanRepayment(ctx, loanId, { amount: 20000, paidOn: "2026-01-25", reference: "BANK-TRF-1" });
    // balance: 55,000 - 20,000 = 35,000

    await postSchedule(ctx, new Date("2026-02-01"));
  });

  afterAll(async () => db.$disconnect());

  it("decrements the current balance by the installment instead of resetting to the fixed schedule", async () => {
    const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
    // Correct: 35,000 - 11,000 = 24,000.
    // The bug would have reset this to the fixed schedule's 3rd-installment balance: 66,000 - 3*11,000 = 33,000.
    expect(num(loan.outstandingBalance)).toBeCloseTo(24000, 2);
  });

  it("the February payroll repayment row's balanceAfter matches the corrected balance", async () => {
    const feb = await db.loanRepayment.findFirstOrThrow({
      where: { loanId, source: "PAYROLL", month: new Date("2026-02-01") },
    });
    expect(num(feb.balanceAfter)).toBeCloseTo(24000, 2);
  });

  it("the manual repayment recorded a nonzero interest portion instead of 0", async () => {
    const manual = await db.loanRepayment.findFirstOrThrow({ where: { loanId, source: "MANUAL" } });
    expect(num(manual.interest)).toBeGreaterThan(0);
    expect(num(manual.principal)).toBeGreaterThan(0);
    expect(num(manual.principal) + num(manual.interest)).toBeCloseTo(num(manual.amount), 2);
  });
});
