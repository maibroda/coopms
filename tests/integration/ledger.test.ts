import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember, memberLedger } from "@/lib/services/members";
import { createLoan, requestLoan } from "@/lib/services/loans";
import { postSchedule } from "@/lib/services/schedule";
import { num, sum, round2 } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

describe("member ledger reconciliation", () => {
  let adminCtx: Ctx;
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

    const admin = await createUser({ email: "test-admin2@test.local", password: "Password123!", name: "Test Admin", role: "ADMIN" });
    adminCtx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(adminCtx, {
      fullName: "Multi Loan Member",
      dateJoined: "2026-01-01",
      monthlyContribution: 10000,
      openingSavingsBalance: 800000,
    });
    memberId = member.id;
  });

  afterAll(async () => db.$disconnect());

  it("reconciles exactly for a member with two concurrent loans (aggregated deduction)", async () => {
    const loanA = await createLoan(adminCtx, {
      memberId,
      loanAmount: 150000,
      interestRate: 8,
      durationMonths: 10,
      repaymentType: "REDUCING",
      startMonth: "2026-01-01",
    });
    const loanB = await createLoan(adminCtx, {
      memberId,
      loanAmount: 80000,
      interestRate: 6,
      durationMonths: 6,
      repaymentType: "FLAT",
      startMonth: "2026-02-01",
    });

    for (const month of ["01", "02", "03", "04"]) {
      await postSchedule(adminCtx, new Date(`2026-${month}-01`));
    }

    const [a, b] = await Promise.all([
      db.loan.findUniqueOrThrow({ where: { id: loanA.id } }),
      db.loan.findUniqueOrThrow({ where: { id: loanB.id } }),
    ]);
    const expectedOutstanding = round2(sum([num(a.outstandingBalance), num(b.outstandingBalance)]));

    const ledger = await memberLedger(memberId);
    expect(ledger.closingLoanBalance).toBeCloseTo(expectedOutstanding, 2);
  });

  /**
   * Regression test for a real bug found this session: memberLedger summed EVERY loan's
   * totalRepayment as "disbursed" regardless of status, so a PENDING (not-yet-approved) or
   * REJECTED loan request inflated the member's loan balance as if it had actually been paid
   * out. Only loans that were genuinely disbursed at some point (ACTIVE, COMPLETED, DEFAULTED,
   * RESTRUCTURED) should count.
   */
  it("excludes PENDING and REJECTED loans from the ledger entirely", async () => {
    const before = await memberLedger(memberId);

    const memberUser = await createUser({ email: "multi-loan-member@test.local", password: "Password123!", name: "Multi Loan Member", role: "MEMBER", memberId });
    const memberCtx: Ctx = { userId: memberUser.id, role: "MEMBER", name: memberUser.name, email: memberUser.email, memberId };

    await requestLoan(memberCtx, { loanAmount: 30000, interestRate: 5, durationMonths: 4, repaymentType: "FLAT", startMonth: "2026-10-01" });

    const after = await memberLedger(memberId);
    expect(after.closingLoanBalance).toBeCloseTo(before.closingLoanBalance, 2);
    expect(after.closingSavingsBalance).toBeCloseTo(before.closingSavingsBalance, 2);
  });
});
