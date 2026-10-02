import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan } from "@/lib/services/loans";
import { previewSchedule } from "@/lib/services/schedule";
import type { Ctx } from "@/lib/auth/context";

/** Regression test: external members have no payroll to deduct from — they must never appear on
 * the deduction schedule, even if they have an active loan. */
describe("external members are excluded from the payroll deduction schedule", () => {
  let ctx: Ctx;
  let externalMemberId: string;
  let employeeMemberId: string;

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
    const admin = await createUser({ email: "external-payroll-admin@test.local", password: "Password123!", name: "External Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const external = await createMember(ctx, {
      firstName: "External",
      lastName: "Test Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      memberType: "EXTERNAL",
      dateJoined: "2020-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 200000,
    });
    externalMemberId = external.id;
    await createLoan(ctx, { memberId: external.id, loanAmount: 50000, interestRate: 10, durationMonths: 4, repaymentType: "FLAT", startMonth: "2026-01-01" });

    const employee = await createMember(ctx, {
      firstName: "Employee",
      lastName: "Test Member",
      gender: "OTHER",
      houseAddress: "Test address",
      region: "LAGOS",
      nextOfKinName: "Test Kin",
      nextOfKinAddress: "Test address",
      nextOfKinPhone: "08000000000",
      dateJoined: "2020-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 200000,
    });
    employeeMemberId = employee.id;
    await createLoan(ctx, { memberId: employee.id, loanAmount: 50000, interestRate: 10, durationMonths: 4, repaymentType: "FLAT", startMonth: "2026-01-01" });
  });

  afterAll(async () => db.$disconnect());

  it("excludes the external member's row from the schedule preview", async () => {
    const preview = await previewSchedule(ctx, new Date("2026-01-01"));
    const memberIds = preview.rows.map((r) => r.memberId);
    expect(memberIds).not.toContain(externalMemberId);
    expect(memberIds).toContain(employeeMemberId);
  });
});
