import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createSale, recordSaleRepayment } from "@/lib/services/sales";
import { num, round2 } from "@/lib/money";
import type { Ctx } from "@/lib/auth/context";

describe("sales interest allocation", () => {
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
    const admin = await createUser({ email: "sales-interest-admin@test.local", password: "Password123!", name: "Sales Admin", role: "ADMIN" });
    ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
    const member = await createMember(ctx, {
      firstName: "Sales",
      lastName: "Interest Member",
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
    memberId = member.id;
  });

  afterAll(async () => db.$disconnect());

  it("allocates each payment's interest proportionally, and caps at the sale's total interest once fully paid", async () => {
    // ₦40,000 item @ 10% flat = ₦4,000 interest, ₦44,000 total repayment.
    // Interest ratio = 4000/44000 = 1/11 of every naira collected.
    const sale = await createSale(ctx, {
      memberId,
      itemName: "Test Laptop",
      category: "LAPTOP",
      cost: 40000,
      interestRate: 10,
      durationMonths: 4,
      startMonth: "2026-01-01",
    });

    const r1 = await recordSaleRepayment(ctx, sale.id, { amount: 11000, paidOn: "2026-02-01" });
    expect(num(r1.interest)).toBeCloseTo(round2(11000 * (4000 / 44000)), 2);
    expect(num(r1.principal)).toBeCloseTo(11000 - num(r1.interest), 2);

    await recordSaleRepayment(ctx, sale.id, { amount: 20000, paidOn: "2026-03-01" });
    await recordSaleRepayment(ctx, sale.id, { amount: 13000, paidOn: "2026-04-01" }); // pays off the remaining 13,000

    const allRepayments = await db.productRepayment.findMany({ where: { saleId: sale.id } });
    const totalInterestRecognized = allRepayments.reduce((a, r) => a + num(r.interest), 0);
    const totalPrincipalRecognized = allRepayments.reduce((a, r) => a + num(r.principal), 0);
    const totalAmount = allRepayments.reduce((a, r) => a + num(r.amount), 0);

    expect(round2(totalInterestRecognized)).toBeCloseTo(4000, 2); // never exceeds totalInterest
    expect(round2(totalPrincipalRecognized)).toBeCloseTo(40000, 2); // all principal eventually recognized
    expect(round2(totalAmount)).toBe(44000);

    const finalSale = await db.productSale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(finalSale.status).toBe("COMPLETED");
    expect(num(finalSale.outstandingBalance)).toBe(0);
  });
});
