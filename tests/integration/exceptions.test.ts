import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createLoan, approveLoan, rejectLoan } from "@/lib/services/loans";
import type { Ctx } from "@/lib/auth/context";

describe("loan eligibility exceptions", () => {
  let adminCtx: Ctx;
  let treasurerCtx: Ctx;
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

    const admin = await createUser({ email: "exc-admin@test.local", password: "Password123!", name: "Exc Admin", role: "ADMIN" });
    const treasurer = await createUser({ email: "exc-treasurer@test.local", password: "Password123!", name: "Exc Treasurer", role: "TREASURER" });
    adminCtx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
    treasurerCtx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };

    const member = await createMember(adminCtx, {
      fullName: "Exception Test Member",
      dateJoined: "2026-01-01",
      monthlyContribution: 5000,
      openingSavingsBalance: 100000, // caps borrowing at 150,000
    });
    memberId = member.id;
  });

  afterAll(async () => db.$disconnect());

  it("hard-declines an over-cap request with no exception reason", async () => {
    await expect(
      createLoan(adminCtx, { memberId, loanAmount: 200000, interestRate: 10, durationMonths: 12, repaymentType: "FLAT", startMonth: "2026-06-01" }),
    ).rejects.toThrow(/exceeds|declined/i);
  });

  it("allows the same request through as a flagged, PENDING exception when a reason is given", async () => {
    const loan = await createLoan(adminCtx, {
      memberId,
      loanAmount: 200000,
      interestRate: 10,
      durationMonths: 12,
      repaymentType: "FLAT",
      startMonth: "2026-06-01",
      exceptionReason: "Board-approved hardship case.",
    });
    expect(loan.isExceptionRequest).toBe(true);
    // Even created by an Admin, an exception is never auto-approved.
    expect(loan.status).toBe("PENDING");
  });

  it("a Treasurer cannot approve an exception loan, even one they didn't request", async () => {
    const loan = await db.loan.findFirstOrThrow({ where: { memberId, isExceptionRequest: true } });
    await expect(approveLoan(treasurerCtx, loan.id)).rejects.toThrow(/Admin/i);
  });

  it("an Admin (not the requester) can approve the exception", async () => {
    const loan = await db.loan.findFirstOrThrow({ where: { memberId, isExceptionRequest: true } });
    const otherAdmin = await createUser({ email: "exc-admin2@test.local", password: "Password123!", name: "Second Admin", role: "ADMIN" });
    const otherAdminCtx: Ctx = { userId: otherAdmin.id, role: "ADMIN", name: otherAdmin.name, email: otherAdmin.email };
    const approved = await approveLoan(otherAdminCtx, loan.id);
    expect(approved.status).toBe("ACTIVE");
  });

  it("rejecting an exception loan requires a reason and records it", async () => {
    const loan = await createLoan(adminCtx, {
      memberId,
      loanAmount: 250000,
      interestRate: 10,
      durationMonths: 12,
      repaymentType: "FLAT",
      startMonth: "2026-07-01",
      exceptionReason: "Second exception request for testing rejection.",
    });
    const otherAdmin = await createUser({ email: "exc-admin3@test.local", password: "Password123!", name: "Third Admin", role: "ADMIN" });
    const otherAdminCtx: Ctx = { userId: otherAdmin.id, role: "ADMIN", name: otherAdmin.name, email: otherAdmin.email };
    const rejected = await rejectLoan(otherAdminCtx, loan.id, "Exceeds what the Board approved.");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Exceeds what the Board approved.");
  });
});
