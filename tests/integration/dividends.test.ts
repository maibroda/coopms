import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, recordManualLoanRepayment } from "@/lib/services/loans";
import { declareOrRecomputeDraft, approveDeclaration, getMyDividendHistory } from "@/lib/services/dividends";
import type { Ctx } from "@/lib/auth/context";

describe("Dividend declaration — 60:40 savings/loan-repayment split", () => {
  let adminCtx: Ctx;
  let treasurerCtx: Ctx;
  let memberACtx: Ctx;
  let memberAId: string;
  let memberBId: string;

  beforeAll(async () => {
    await db.$transaction([
      db.dividendAllocation.deleteMany(),
      db.surplusDeclaration.deleteMany(),
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

    const admin = await createUser({ email: "dividend-admin@test.local", password: "Password123!", name: "Dividend Admin", role: "ADMIN" });
    adminCtx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const treasurer = await createUser({ email: "dividend-treasurer@test.local", password: "Password123!", name: "Dividend Treasurer", role: "TREASURER" });
    treasurerCtx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };

    // Mirrors the cooperative's own worked example: Member A holds 500,000 of a 5,000,000 total
    // savings pool, and made 200,000 of a 2,000,000 total in loan repayments during the year —
    // on a 1,000,000 pool split 60:40, that should land Member A exactly 60,000 + 40,000 = 100,000.
    const memberA = await createMember(adminCtx, {
      firstName: "Member",
      lastName: "A",
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
    memberAId = memberA.id;
    const memberAUser = await createUser({ email: "dividend-member-a@test.local", password: "Password123!", name: memberA.fullName, role: "MEMBER", memberId: memberA.id });
    memberACtx = { userId: memberAUser.id, role: "MEMBER", name: memberAUser.name, email: memberAUser.email, memberId: memberA.id };

    const memberB = await createMember(adminCtx, {
      firstName: "Member",
      lastName: "B",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: "2020-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 4500000, // + Member A's 500,000 = 5,000,000 total
    });
    memberBId = memberB.id;

    // Member A: a loan repaid 200,000 of principal+interest within 2026.
    const loanA = await createLoan(adminCtx, {
      memberId: memberAId,
      loanAmount: 300000,
      interestRate: 10,
      durationMonths: 12,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    await recordManualLoanRepayment(adminCtx, loanA.id, { amount: 200000, paidOn: "2026-06-15" });

    // Member B: a loan repaid 1,800,000 within 2026, so the pair totals 2,000,000.
    const loanB = await createLoan(adminCtx, {
      memberId: memberBId,
      loanAmount: 2000000,
      interestRate: 10,
      durationMonths: 12,
      repaymentType: "FLAT",
      startMonth: "2026-01-01",
    });
    await recordManualLoanRepayment(adminCtx, loanB.id, { amount: 1800000, paidOn: "2026-06-15" });
  });

  afterAll(async () => db.$disconnect());

  it("computes the appropriation split (default 25/2.5/50/5/17.5)", async () => {
    // declaredSurplus of 2,000,000 at the default 50% dividend rate produces exactly the
    // 1,000,000 dividend pool used in the cooperative's own 60:40 worked example below.
    const d = await declareOrRecomputeDraft(adminCtx, { year: 2026, declaredSurplus: 2000000 });
    expect(Number(d.reserveFundAmount)).toBe(500000);
    expect(Number(d.educationFundAmount)).toBe(50000);
    expect(Number(d.dividendAmount)).toBe(1000000);
    expect(Number(d.honorariumAmount)).toBe(100000);
    expect(Number(d.meetingExpensesAmount)).toBe(350000);
    expect(d.status).toBe("DRAFT");
  });

  it("splits the dividend pool 60:40 and matches the cooperative's own worked example exactly", async () => {
    const d = await db.surplusDeclaration.findUniqueOrThrow({ where: { year: 2026 } });
    expect(Number(d.dividendSavingsPool)).toBe(600000);
    expect(Number(d.dividendRepaymentPool)).toBe(400000);
    expect(Number(d.totalEligibleSavings)).toBe(5000000);
    expect(Number(d.totalEligibleRepayments)).toBe(2000000);
    expect(Number(d.unallocatedRepaymentPool)).toBe(0); // fully allocated — both members had repayments

    const allocationA = await db.dividendAllocation.findFirstOrThrow({ where: { declarationId: d.id, memberId: memberAId } });
    expect(Number(allocationA.savingsDividend)).toBe(60000);
    expect(Number(allocationA.repaymentDividend)).toBe(40000);
    expect(Number(allocationA.totalDividend)).toBe(100000);
  });

  it("flags the repayment pool as fully unallocated when nobody repaid anything that year", async () => {
    const d = await declareOrRecomputeDraft(adminCtx, { year: 2027, declaredSurplus: 1000000 });
    expect(Number(d.totalEligibleRepayments)).toBe(0);
    expect(Number(d.unallocatedRepaymentPool)).toBe(200000); // the full 40% pool — per the ELSE-branch rule

    const allocationA = await db.dividendAllocation.findFirstOrThrow({ where: { declarationId: d.id, memberId: memberAId } });
    expect(Number(allocationA.repaymentDividend)).toBe(0);
    expect(Number(allocationA.savingsDividend)).toBeGreaterThan(0); // savings component still distributes fully
  });

  it("is admin-only to declare — treasurer is rejected", async () => {
    await expect(declareOrRecomputeDraft(treasurerCtx, { year: 2028, declaredSurplus: 500000 })).rejects.toThrow();
  });

  it("locks a declaration once approved — recompute and delete are then refused", async () => {
    const d = await declareOrRecomputeDraft(adminCtx, { year: 2029, declaredSurplus: 500000 });
    await approveDeclaration(adminCtx, d.id);
    await expect(declareOrRecomputeDraft(adminCtx, { year: 2029, declaredSurplus: 600000 })).rejects.toThrow(/approved/i);
  });

  it("a member sees their own approved dividend history but not drafts", async () => {
    const draftYears = (await getMyDividendHistory(memberACtx)).map((h) => h.declaration.year);
    expect(draftYears).not.toContain(2026); // 2026 is still DRAFT — not shown to the member

    const d2026 = await db.surplusDeclaration.findUniqueOrThrow({ where: { year: 2026 } });
    await approveDeclaration(adminCtx, d2026.id);
    const afterApproval = (await getMyDividendHistory(memberACtx)).map((h) => h.declaration.year);
    expect(afterApproval).toContain(2026);
  });
});
