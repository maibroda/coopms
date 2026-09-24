import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember, memberLedger } from "@/lib/services/members";
import { createLoan, suspendLoan } from "@/lib/services/loans";
import { postSchedule } from "@/lib/services/schedule";
import { num } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

/**
 * Regression test for a real bug found this session: loan suspension used to be keyed off
 * calendar-elapsed months, so a suspended month's installment was silently SKIPPED FOREVER
 * (the loan reached its final scheduled index on calendar time and completed having collected
 * fewer payments than it should have — effectively forgiving the suspended months). Repayments
 * must instead be keyed off how many installments have actually been posted, so suspension only
 * DEFERS collection — the member still owes it, just later.
 */
describe("loan suspension defers installments instead of forgiving them", () => {
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

    const admin = await createUser({ email: "test-admin@test.local", password: "Password123!", name: "Test Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(ctx, {
      fullName: "Suspension Test Member",
      dateJoined: "2026-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 500000,
    });
    memberId = member.id;

    const loan = await createLoan(ctx, {
      memberId,
      loanAmount: 90000,
      interestRate: 8,
      durationMonths: 6,
      repaymentType: "REDUCING",
      startMonth: "2026-01-01",
    });
    loanId = loan.id;

    // Suspend March and April; the loan should resume in May and still need 2 more payments
    // after the 4 it collects across Jan/Feb/May/Jun.
    await suspendLoan(ctx, loanId, "2026-03-01", "2026-05-01");

    for (const month of ["01", "02", "03", "04", "05", "06"]) {
      await postSchedule(ctx, new Date(`2026-${month}-01`));
    }
  });

  afterAll(async () => db.$disconnect());

  it("posts installments for the active months and skips the suspended ones", async () => {
    const repayments = await db.loanRepayment.findMany({ where: { loanId }, orderBy: { month: "asc" } });
    const months = repayments.map((r) => r.month.toISOString().slice(0, 7));
    expect(months).toEqual(["2026-01", "2026-02", "2026-05", "2026-06"]);
  });

  it("does not complete the loan early — installments were deferred, not dropped", async () => {
    const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(loan.status).toBe("ACTIVE");
    expect(num(loan.outstandingBalance)).toBeGreaterThan(0);
  });

  it("auto-resumes the loan once the suspension window has passed", async () => {
    const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(loan.suspendedFrom).toBeNull();
    expect(loan.suspendedUntil).toBeNull();
  });

  it("member ledger's closing loan balance reconciles exactly with Loan.outstandingBalance", async () => {
    const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
    const ledger = await memberLedger(memberId);
    expect(ledger.closingLoanBalance).toBeCloseTo(num(loan.outstandingBalance), 2);
  });

  it("posting the same month twice does not create a duplicate installment", async () => {
    // June was already posted in beforeAll; re-posting the whole month is blocked at the
    // DeductionScheduleRun level, but this also guards the per-loan idempotency directly.
    const before = await db.loanRepayment.count({ where: { loanId } });
    await expect(postSchedule(ctx, new Date("2026-06-01"))).rejects.toThrow();
    const after = await db.loanRepayment.count({ where: { loanId } });
    expect(after).toBe(before);
  });
});
