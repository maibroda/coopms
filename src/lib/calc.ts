import { round2 } from "@/lib/money";

export type RepaymentType = "FLAT" | "REDUCING";

export interface AmortizationRow {
  /** 0-based month offset from the loan's start month. */
  index: number;
  principal: number;
  interest: number;
  installment: number;
  balanceAfter: number;
}

export interface LoanCalc {
  totalInterest: number;
  totalRepayment: number;
  /** Standard monthly installment (the final month may differ by a few kobo of rounding). */
  monthlyRepayment: number;
  schedule: AmortizationRow[];
}

/**
 * Flat rate: interest = principal * rate / 100, spread evenly across the term.
 * This matches the cooperative's worked example exactly (₦200,000 @ 10% / 12mo → ₦18,333.33/mo).
 */
function flatSchedule(principal: number, ratePercent: number, durationMonths: number): AmortizationRow[] {
  const totalInterest = round2((principal * ratePercent) / 100);
  const totalRepayment = round2(principal + totalInterest);
  const monthlyPrincipal = round2(principal / durationMonths);
  const monthlyInstallment = round2(totalRepayment / durationMonths);

  const rows: AmortizationRow[] = [];
  let balance = totalRepayment;
  for (let i = 0; i < durationMonths; i++) {
    const isLast = i === durationMonths - 1;
    const principalPart = isLast ? round2(principal - monthlyPrincipal * (durationMonths - 1)) : monthlyPrincipal;
    const installment = isLast ? round2(balance) : monthlyInstallment;
    // Derived from the installment so principal + interest always reconciles to the amount charged.
    const interestPart = round2(installment - principalPart);
    balance = Math.max(round2(balance - installment), 0);
    rows.push({ index: i, principal: principalPart, interest: interestPart, installment, balanceAfter: balance });
  }
  return rows;
}

/**
 * Reducing balance: standard declining-balance amortization. `ratePercent` is treated as the
 * rate charged per month on the outstanding principal (equal-installment / EMI method).
 *
 * `balanceAfter` is the remaining TOTAL obligation (principal + all interest still to come) —
 * the same meaning it has for a flat loan — not the declining principal used internally to
 * compute each month's interest. Loan.outstandingBalance app-wide means "how much is still
 * owed in total"; if this returned principal-only it would understate what's owed and silently
 * desync from every other total (dashboards, eligibility checks, statements) once payments start.
 */
function reducingSchedule(principal: number, ratePercent: number, durationMonths: number): AmortizationRow[] {
  const r = ratePercent / 100;
  const emi =
    r === 0
      ? round2(principal / durationMonths)
      : round2((principal * r * Math.pow(1 + r, durationMonths)) / (Math.pow(1 + r, durationMonths) - 1));

  const raw: { principal: number; interest: number; installment: number }[] = [];
  let principalBalance = principal;
  for (let i = 0; i < durationMonths; i++) {
    const isLast = i === durationMonths - 1;
    const interestPart = round2(principalBalance * r);
    let principalPart = round2(emi - interestPart);
    let installment = emi;
    if (isLast) {
      principalPart = principalBalance;
      installment = round2(principalBalance + interestPart);
    }
    principalBalance = Math.max(round2(principalBalance - principalPart), 0);
    raw.push({ principal: principalPart, interest: interestPart, installment });
  }

  const totalRepayment = round2(raw.reduce((a, r) => a + r.installment, 0));
  const rows: AmortizationRow[] = [];
  let remainingTotal = totalRepayment;
  for (let i = 0; i < durationMonths; i++) {
    remainingTotal = Math.max(round2(remainingTotal - raw[i].installment), 0);
    rows.push({ index: i, principal: raw[i].principal, interest: raw[i].interest, installment: raw[i].installment, balanceAfter: remainingTotal });
  }
  return rows;
}

export function calcLoan(
  principal: number,
  ratePercent: number,
  durationMonths: number,
  type: RepaymentType,
): LoanCalc {
  const schedule = type === "FLAT" ? flatSchedule(principal, ratePercent, durationMonths) : reducingSchedule(principal, ratePercent, durationMonths);
  const totalInterest = round2(schedule.reduce((a, r) => a + r.interest, 0));
  const totalRepayment = round2(schedule.reduce((a, r) => a + r.installment, 0));
  return { totalInterest, totalRepayment, monthlyRepayment: schedule[0]?.installment ?? 0, schedule };
}

/** Product sales use the same flat-rate math as the cooperative's worked example. */
export function calcProductSale(cost: number, ratePercent: number, durationMonths: number): LoanCalc {
  return calcLoan(cost, ratePercent, durationMonths, "FLAT");
}
