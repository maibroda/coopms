import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { checkLoanEligibility } from "@/lib/services/loans";
import { getSettings, updateSettings } from "@/lib/services/settings";
import type { Ctx } from "@/lib/auth/context";

describe("configurable loan eligibility multiplier", () => {
  let adminCtx: Ctx;
  let memberId: string;

  beforeAll(async () => {
    await db.$transaction([
      db.paymentClaim.deleteMany(),
      db.auditLog.deleteMany(),
      db.loanProduct.deleteMany(),
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

    const admin = await createUser({ email: "settings-admin@test.local", password: "Password123!", name: "Settings Admin", role: "ADMIN" });
    adminCtx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(adminCtx, {
      fullName: "Multiplier Test Member",
      dateJoined: "2026-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 100000,
    });
    memberId = member.id;
  });

  afterAll(async () => db.$disconnect());

  it("defaults to a 1.5x (150%) multiplier when no settings row exists yet", async () => {
    const eligibility = await checkLoanEligibility(memberId);
    expect(eligibility.maxBorrowable).toBeCloseTo(150000, 2); // 100,000 savings * 1.5
  });

  it("uses the Admin-configured multiplier once changed", async () => {
    await updateSettings(adminCtx, { orgName: "Test Coop", currencySymbol: "₦", loanEligibilityMultiplier: 2 });
    const settings = await getSettings();
    expect(settings.loanEligibilityMultiplier).toBe(2);

    const eligibility = await checkLoanEligibility(memberId);
    expect(eligibility.maxBorrowable).toBeCloseTo(200000, 2); // 100,000 savings * 2.0, not the old 1.5 default
  });

  it("a non-Admin cannot change settings", async () => {
    const treasurer = await createUser({ email: "settings-treasurer@test.local", password: "Password123!", name: "Settings Treasurer", role: "TREASURER" });
    const treasurerCtx: Ctx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };
    await expect(updateSettings(treasurerCtx, { orgName: "Hijacked", currencySymbol: "$", loanEligibilityMultiplier: 5 })).rejects.toThrow();
  });
});
