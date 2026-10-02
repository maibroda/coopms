import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser } from "@/lib/services/auth";
import { createMember } from "@/lib/services/members";
import { createSale, requestSale } from "@/lib/services/sales";
import { setProductSalesOpen } from "@/lib/services/settings";
import type { Ctx } from "@/lib/auth/context";

describe("Product Sales seasonal window", () => {
  let adminCtx: Ctx;
  let memberCtx: Ctx;
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
    const admin = await createUser({ email: "sales-window-admin@test.local", password: "Password123!", name: "Sales Window Admin", role: "ADMIN" });
    adminCtx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };

    const member = await createMember(adminCtx, {
      firstName: "Sales",
      lastName: "Window Member",
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
    const memberUser = await createUser({ email: "sales-window-member@test.local", password: "Password123!", name: member.fullName, role: "MEMBER", memberId: member.id });
    memberCtx = { userId: memberUser.id, role: "MEMBER", name: memberUser.name, email: memberUser.email, memberId: member.id };
  });

  afterAll(async () => db.$disconnect());

  it("defaults to open — a sale can be created without touching the setting", async () => {
    const sale = await createSale(adminCtx, {
      memberId,
      itemName: "Default Window Phone",
      category: "PHONE",
      cost: 20000,
      interestRate: 5,
      durationMonths: 3,
      startMonth: "2026-01-01",
    });
    expect(sale.status).toBe("ACTIVE");
  });

  it("blocks both staff-created sales and member requests once closed", async () => {
    await setProductSalesOpen(adminCtx, false);

    await expect(
      createSale(adminCtx, { memberId, itemName: "Closed Window Phone", category: "PHONE", cost: 10000, interestRate: 5, durationMonths: 2, startMonth: "2026-02-01" }),
    ).rejects.toThrow(/currently closed/i);

    await expect(
      requestSale(memberCtx, { itemName: "Closed Window Phone Request", category: "PHONE", cost: 10000, interestRate: 5, durationMonths: 2, startMonth: "2026-02-01" }),
    ).rejects.toThrow(/currently closed/i);
  });

  it("reopening the window immediately allows sales again", async () => {
    await setProductSalesOpen(adminCtx, true);
    const sale = await createSale(adminCtx, {
      memberId,
      itemName: "Reopened Window Phone",
      category: "PHONE",
      cost: 15000,
      interestRate: 5,
      durationMonths: 3,
      startMonth: "2026-03-01",
    });
    expect(sale.status).toBe("ACTIVE");
  });

  it("is admin-only to toggle", async () => {
    const treasurer = await createUser({ email: "sales-window-treasurer@test.local", password: "Password123!", name: "Sales Window Treasurer", role: "TREASURER" });
    const treasurerCtx: Ctx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };
    await expect(setProductSalesOpen(treasurerCtx, false)).rejects.toThrow();
  });
});
