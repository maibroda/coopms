import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, recomputeEarlyPayoff, adjustLoan } from "@/lib/services/loans";
import { postSchedule } from "@/lib/services/schedule";
import { num } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

describe("early payoff recompute and admin loan adjustment", () => {
  let ctx: Ctx;
  let memberId: string;

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

    const admin = await createUser({ email: "payoff-admin@test.local", password: "Password123!", name: "Payoff Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(ctx, {
      firstName: "Payoff",
      lastName: "Test Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: "2026-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 500000,
    });
    memberId = member.id;
  });

  afterAll(async () => db.$disconnect());

  it("rebates unearned interest when recomputed partway through a flat loan", async () => {
    // ₦120,000 @ 12% flat / 12 months = ₦14,400 total interest, ₦134,400 total repayment,
    // ₦11,200/month. After 3 postings (Jan-Mar), only 3 months of interest (₦3,600) is earned.
    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 120000,
      interestRate: 12,
      durationMonths: 12,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    for (const month of ["01", "02", "03"]) {
      await postSchedule(ctx, new Date(`2026-${month}-01`));
    }
    const beforeRecompute = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    // Full schedule would still show 9 more months of obligation (₦134,400 - 3×11,200 = ₦100,800).
    expect(num(beforeRecompute.outstandingBalance)).toBeCloseTo(100800, 2);

    const updated = await recomputeEarlyPayoff(ctx, loan.id, "2026-03-15");
    // Fair obligation = full principal (120,000) + interest earned for 3 elapsed months (3,600)
    // = 123,600, less the 33,600 already paid (3 × 11,200) = 90,000 still owed — a 10,800 rebate
    // of interest that hadn't accrued yet versus the original schedule's 100,800.
    expect(num(updated.outstandingBalance)).toBeCloseTo(90000, 2);
    expect(num(updated.outstandingBalance)).toBeLessThan(num(beforeRecompute.outstandingBalance));
  });

  it("refuses to recompute when there's no rebate to give (loan already fully elapsed)", async () => {
    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 30000,
      interestRate: 10,
      durationMonths: 2,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    // Asking "as of" a date past the full 2-month term — every month's interest has elapsed, so
    // there's nothing left to rebate.
    await expect(recomputeEarlyPayoff(ctx, loan.id, "2026-06-01")).rejects.toThrow(/no early-payoff rebate/i);
  });

  it("admin-adjust corrects a wrongly-entered loan's terms and nets off what's already been paid", async () => {
    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 50000,
      interestRate: 10,
      durationMonths: 5,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    await postSchedule(ctx, new Date("2026-04-01"));
    // One installment posted: 50,000 * 1.1 / 5 = 11,000 paid so far.

    // Staff mis-keyed the amount as 50,000 — it should have been 500,000.
    const corrected = await adjustLoan(ctx, loan.id, {
      loanAmount: 500000,
      interestRate: 10,
      durationMonths: 5,
      repaymentType: "FLAT",
      startMonth: "2026-04-01",
    });
    // New total repayment = 500,000 * 1.1 = 550,000, less the 11,000 already collected.
    expect(num(corrected.loanAmount)).toBe(500000);
    expect(num(corrected.outstandingBalance)).toBeCloseTo(550000 - 11000, 2);
  });

  it("admin-adjust is refused for non-admin roles", async () => {
    const treasurer = await createUser({ email: "payoff-treasurer@test.local", password: "Password123!", name: "Payoff Treasurer", role: "TREASURER" });
    const treasurerCtx: Ctx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };
    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 20000,
      interestRate: 5,
      durationMonths: 3,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    await expect(
      adjustLoan(treasurerCtx, loan.id, { loanAmount: 25000, interestRate: 5, durationMonths: 3, repaymentType: "FLAT", startMonth: "2026-01-01" }),
    ).rejects.toThrow();
  });
});
