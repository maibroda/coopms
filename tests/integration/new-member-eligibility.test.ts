import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, checkLoanEligibility } from "@/lib/services/loans";
import { createSale } from "@/lib/services/sales";
import type { Ctx } from "@/lib/auth/context";

describe("new members under 6 months can't borrow, but can still buy on credit", () => {
  let ctx: Ctx;

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
    const admin = await createUser({ email: "tenure-admin@test.local", password: "Password123!", name: "Tenure Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
  });

  afterAll(async () => db.$disconnect());

  it("flags a member who joined last month as too new to borrow", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const member = await createMember(ctx, {
      firstName: "Brand",
      lastName: "New Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: lastMonth.toISOString().slice(0, 10),
      monthlyContribution: 5000,
      openingSavingsBalance: 100000,
    });
    const eligibility = await checkLoanEligibility(member.id, 10000);
    expect(eligibility.tooNewToBorrow).toBe(true);
    expect(eligibility.eligible).toBe(false);

    await expect(
      createLoan(ctx, { memberId: member.id, loanAmount: 10000, interestRate: 5, durationMonths: 3, repaymentType: "FLAT", startMonth: "2026-01-01" }),
    ).rejects.toThrow(/less than 6 months/i);
  });

  it("the same brand-new member can still buy on credit", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const member = await createMember(ctx, {
      firstName: "Another",
      lastName: "New Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: lastMonth.toISOString().slice(0, 10),
      monthlyContribution: 5000,
      openingSavingsBalance: 100000,
    });
    const sale = await createSale(ctx, {
      memberId: member.id,
      itemName: "Test Phone",
      category: "PHONE",
      cost: 20000,
      interestRate: 10,
      durationMonths: 4,
      startMonth: "2026-01-01",
    });
    expect(sale.status).toBe("ACTIVE");
  });

  it("a member who joined 7 months ago is eligible to borrow", async () => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const member = await createMember(ctx, {
      firstName: "Established",
      lastName: "Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: sevenMonthsAgo.toISOString().slice(0, 10),
      monthlyContribution: 5000,
      openingSavingsBalance: 100000,
    });
    const eligibility = await checkLoanEligibility(member.id, 10000);
    expect(eligibility.tooNewToBorrow).toBe(false);
    expect(eligibility.eligible).toBe(true);
  });
});
