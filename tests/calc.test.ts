import { describe, it, expect } from "vitest";
import { calcLoan, calcProductSale } from "@/lib/calc";

describe("calcLoan — FLAT", () => {
  it("matches the cooperative's worked example (₦200,000 @ 10% / 12mo)", () => {
    const r = calcLoan(200000, 10, 12, "FLAT");
    expect(r.totalInterest).toBe(20000);
    expect(r.totalRepayment).toBe(220000);
    expect(r.monthlyRepayment).toBeCloseTo(18333.33, 2);
    expect(r.schedule).toHaveLength(12);
  });

  it("every row's principal + interest reconciles exactly to the installment", () => {
    const r = calcLoan(200000, 10, 12, "FLAT");
    for (const row of r.schedule) {
      expect(row.principal + row.interest).toBeCloseTo(row.installment, 2);
    }
  });

  it("balance reaches exactly zero at the final installment", () => {
    const r = calcLoan(200000, 10, 12, "FLAT");
    expect(r.schedule.at(-1)!.balanceAfter).toBe(0);
  });

  it("balanceAfter decreases by exactly the installment each row", () => {
    const r = calcLoan(97000, 12, 5, "FLAT");
    let expected = r.totalRepayment;
    for (const row of r.schedule) {
      expected = Math.round((expected - row.installment) * 100) / 100;
      expect(row.balanceAfter).toBeCloseTo(expected, 2);
    }
  });
});

describe("calcLoan — REDUCING", () => {
  /**
   * Regression test for a real bug found this session: balanceAfter used to track the
   * declining PRINCIPAL (standard amortization internals), not the remaining TOTAL obligation
   * (principal + all interest still to come). Since Loan.outstandingBalance means "how much is
   * still owed in total" everywhere else in the app, a reducing loan's balance silently
   * understated what was owed the moment repayments started — this pins the correct behavior.
   */
  it("balanceAfter is the remaining total obligation, not remaining principal", () => {
    const r = calcLoan(150000, 8, 10, "REDUCING");
    let remainingTotal = r.totalRepayment;
    for (const row of r.schedule) {
      remainingTotal = Math.round((remainingTotal - row.installment) * 100) / 100;
      expect(row.balanceAfter).toBeCloseTo(remainingTotal, 2);
    }
  });

  it("every row's principal + interest reconciles exactly to the installment", () => {
    const r = calcLoan(150000, 8, 10, "REDUCING");
    for (const row of r.schedule) {
      expect(row.principal + row.interest).toBeCloseTo(row.installment, 2);
    }
  });

  it("installment is constant across the term (equal-installment / EMI method)", () => {
    const r = calcLoan(150000, 8, 10, "REDUCING");
    const first = r.schedule[0].installment;
    for (const row of r.schedule.slice(0, -1)) {
      expect(row.installment).toBeCloseTo(first, 2);
    }
  });

  it("balance reaches exactly zero at the final installment", () => {
    const r = calcLoan(150000, 8, 10, "REDUCING");
    expect(r.schedule.at(-1)!.balanceAfter).toBe(0);
  });

  it("interest is front-loaded — later rows have less interest than earlier rows", () => {
    const r = calcLoan(150000, 8, 10, "REDUCING");
    expect(r.schedule[0].interest).toBeGreaterThan(r.schedule.at(-1)!.interest);
  });

  it("a 0% reducing loan behaves like an interest-free installment plan", () => {
    const r = calcLoan(120000, 0, 12, "REDUCING");
    expect(r.totalInterest).toBe(0);
    expect(r.totalRepayment).toBe(120000);
    expect(r.monthlyRepayment).toBeCloseTo(10000, 2);
  });
});

describe("calcProductSale", () => {
  it("matches the spec's worked example (₦120,000 @ 5% / 6mo → ₦21,000/mo)", () => {
    const r = calcProductSale(120000, 5, 6);
    expect(r.totalInterest).toBe(6000);
    expect(r.totalRepayment).toBe(126000);
    expect(r.monthlyRepayment).toBeCloseTo(21000, 2);
  });

  it("uses flat-rate math, same as calcLoan FLAT", () => {
    const sale = calcProductSale(200000, 10, 12);
    const loan = calcLoan(200000, 10, 12, "FLAT");
    expect(sale.totalInterest).toBe(loan.totalInterest);
    expect(sale.totalRepayment).toBe(loan.totalRepayment);
    expect(sale.monthlyRepayment).toBe(loan.monthlyRepayment);
  });
});
