import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, suspendLoan } from "@/lib/services/loans";
import { postSchedule } from "@/lib/services/schedule";
import { num, round2 } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

/**
 * A deferred (suspended) installment carries a 10% penalty when it's eventually collected after
 * the loan resumes — charged on exactly the installments that were pushed out, not on every
 * future payment, and recorded separately from the loan's own principal/interest so the loan's
 * balance reconciliation (amount vs outstandingBalance) isn't affected by the penalty.
 */
describe("loan deferment penalty", () => {
  let ctx: Ctx;
  let memberId: string;
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

    const admin = await createUser({ email: "deferment-admin@test.local", password: "Password123!", name: "Deferment Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(ctx, {
      firstName: "Deferment",
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

    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 60000,
      interestRate: 10,
      durationMonths: 4,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    loanId = loan.id;

    // Defer February only; the loan resumes in March.
    await suspendLoan(ctx, loanId, "2026-02-01", "2026-03-01");

    for (const month of ["01", "02", "03", "04"]) {
      await postSchedule(ctx, new Date(`2026-${month}-01`));
    }
  });

  afterAll(async () => db.$disconnect());

  it("skips the deferred month and increments the pending-penalty counter", async () => {
    const repayments = await db.loanRepayment.findMany({ where: { loanId }, orderBy: { month: "asc" } });
    const months = repayments.map((r) => r.month.toISOString().slice(0, 7));
    expect(months).toEqual(["2026-01", "2026-03", "2026-04"]);
  });

  it("charges a 10% penalty on the first installment collected after resuming, and none after", async () => {
    const repayments = await db.loanRepayment.findMany({ where: { loanId }, orderBy: { month: "asc" } });
    const [jan, mar, apr] = repayments;
    const baseInstallment = num(jan.amount); // Jan wasn't deferred, so its amount is the plain installment.

    expect(num(jan.penaltyAmount)).toBe(0);
    expect(num(mar.penaltyAmount)).toBeCloseTo(round2(baseInstallment * 0.1), 2);
    expect(num(apr.penaltyAmount)).toBe(0);

    // The penalty is tracked separately — `amount` (the balance-affecting figure) is the same
    // plain installment every month, undisturbed by the penalty riding alongside it.
    expect(num(mar.amount)).toBeCloseTo(baseInstallment, 2);
  });

  it("the loan's own balance still reconciles against the original schedule, unaffected by the penalty", async () => {
    // 4 calendar months elapsed (Jan-Apr) but only 3 installments were billed (Feb deferred),
    // so one installment of the original 4-month schedule is still outstanding — the deferment
    // pushed the loan's completion out by a month rather than forgiving the missed one.
    const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
    const repayments = await db.loanRepayment.findMany({ where: { loanId } });
    const lastBalanceAfter = num(repayments.sort((a, b) => a.month.getTime() - b.month.getTime()).at(-1)!.balanceAfter);

    expect(loan.deferredInstallments).toBe(0);
    expect(num(loan.outstandingBalance)).toBeCloseTo(lastBalanceAfter, 2);
    expect(num(loan.outstandingBalance)).toBeGreaterThan(0);
    expect(loan.status).toBe("ACTIVE");
  });
});
