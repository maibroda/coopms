import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { calcLoan } from "@/lib/calc";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import type { RepaymentType } from "@/lib/calc";

function requirePerm(ctx: Ctx, perm: "schedule.view" | "schedule.post") {
  if (!can(ctx.role, perm)) throw new ForbiddenError(perm);
}

const DEFERMENT_PENALTY_RATE = 0.10;

export interface ScheduleRow {
  memberId: string;
  membershipNumber: string;
  fullName: string;
  department: string | null;
  savings: number;
  /** Principal portion of this month's loan repayment, summed across all the member's loans. */
  loanPrincipal: number;
  /** Interest portion (including any deferment penalty) of this month's loan repayment. */
  loanInterest: number;
  loanRepayment: number;
  total: number;
  loanBreakdown: { loanId: string; amount: number; principal: number; interest: number; penalty: number }[];
}

export interface SchedulePreview {
  month: Date;
  rows: ScheduleRow[];
  totals: { savings: number; loanPrincipal: number; loanInterest: number; loanRepayment: number; total: number };
  alreadyPosted: boolean;
}

function isSuspended(loan: { suspendedFrom: Date | null; suspendedUntil: Date | null }, month: Date) {
  if (!loan.suspendedFrom || !loan.suspendedUntil) return false;
  return month.getTime() >= loan.suspendedFrom.getTime() && month.getTime() < loan.suspendedUntil.getTime();
}

/**
 * Total Deduction = Monthly Contribution (Savings) + sum of all active loan installments due
 * this month. Loans in their suspension window are skipped for that month — not calendar time,
 * but the number of installments actually POSTED SO FAR (loan._count.repayments), decides which
 * amortization row is next. That's what makes suspension defer installments instead of silently
 * forgiving them: a suspended month simply isn't counted, so the loan just takes longer to clear.
 */
export async function previewSchedule(ctx: Ctx, month: Date): Promise<SchedulePreview> {
  requirePerm(ctx, "schedule.view");
  // EXTERNAL members have no payroll to deduct from — they always settle by direct payment, so
  // they never appear on the deduction schedule regardless of what they owe.
  const members = await db.member.findMany({
    where: { status: "ACTIVE", memberType: "EMPLOYEE", dateJoined: { lte: month } },
    include: {
      loans: { where: { status: "ACTIVE" }, include: { _count: { select: { repayments: true } } } },
    },
    orderBy: { fullName: "asc" },
  });

  const rows: ScheduleRow[] = members.map((m) => {
    const savings = num(m.monthlyContribution);
    const loanBreakdown: { loanId: string; amount: number; principal: number; interest: number; penalty: number }[] = [];
    let loanRepayment = 0;
    let loanPrincipal = 0;
    let loanInterest = 0;
    for (const loan of m.loans) {
      if (loan.startMonth.getTime() > month.getTime()) continue; // not disbursed yet
      if (isSuspended(loan, month)) continue;
      const paidCount = loan._count.repayments;
      if (paidCount >= loan.durationMonths) continue; // fully scheduled — should already be COMPLETED
      const calc = calcLoan(num(loan.loanAmount), num(loan.interestRate), loan.durationMonths, loan.repaymentType as RepaymentType);
      const schedRow = calc.schedule[paidCount];
      const baseInstallment = schedRow?.installment ?? 0;
      // A pending deferment penalty (from a previous suspended month) lands on this installment.
      // It's not principal and not "earned" interest, but it's grouped under the interest portion
      // for the repayment split below — the dedicated penalty column still breaks it out on its own.
      const penalty = loan.deferredInstallments > 0 ? round2(baseInstallment * DEFERMENT_PENALTY_RATE) : 0;
      const installment = round2(baseInstallment + penalty);
      const principal = schedRow?.principal ?? 0;
      const interest = round2((schedRow?.interest ?? 0) + penalty);
      loanBreakdown.push({ loanId: loan.id, amount: installment, principal, interest, penalty });
      loanRepayment = round2(loanRepayment + installment);
      loanPrincipal = round2(loanPrincipal + principal);
      loanInterest = round2(loanInterest + interest);
    }
    return {
      memberId: m.id,
      membershipNumber: m.membershipNumber,
      fullName: m.fullName,
      department: m.department,
      savings,
      loanPrincipal,
      loanInterest,
      loanRepayment,
      total: round2(savings + loanRepayment),
      loanBreakdown,
    };
  });

  const alreadyPosted = !!(await db.deductionScheduleRun.findUnique({ where: { month } }));

  return {
    month,
    rows,
    totals: {
      savings: sum(rows.map((r) => r.savings)),
      loanPrincipal: sum(rows.map((r) => r.loanPrincipal)),
      loanInterest: sum(rows.map((r) => r.loanInterest)),
      loanRepayment: sum(rows.map((r) => r.loanRepayment)),
      total: sum(rows.map((r) => r.total)),
    },
    alreadyPosted,
  };
}

/** Posts the schedule: writes contribution + loan repayment ledger rows, updates loan balances/status. */
export async function postSchedule(ctx: Ctx, month: Date): Promise<SchedulePreview> {
  requirePerm(ctx, "schedule.post");
  const existing = await db.deductionScheduleRun.findUnique({ where: { month } });
  if (existing) throw new Error(`${month.toISOString().slice(0, 7)} has already been posted to payroll.`);

  const preview = await previewSchedule(ctx, month);

  await db.$transaction(async (tx) => {
    for (const row of preview.rows) {
      if (row.savings > 0) {
        await tx.contribution.upsert({
          where: { memberId_month: { memberId: row.memberId, month } },
          create: { memberId: row.memberId, month, amount: row.savings },
          update: {},
        });
      }
      for (const lb of row.loanBreakdown) {
        const already = await tx.loanRepayment.findFirst({ where: { loanId: lb.loanId, month, source: "PAYROLL" } });
        if (already) continue;
        const loan = await tx.loan.findUniqueOrThrow({ where: { id: lb.loanId } });
        const paidCount = await tx.loanRepayment.count({ where: { loanId: loan.id } });
        if (paidCount >= loan.durationMonths) continue;
        const calc = calcLoan(num(loan.loanAmount), num(loan.interestRate), loan.durationMonths, loan.repaymentType as RepaymentType);
        const schedRow = calc.schedule[paidCount];
        if (!schedRow) continue;
        // A pending deferment penalty is collected alongside this installment as an extra fee,
        // not part of the loan's own amortization — `amount` stays the balance-affecting figure
        // (reconciles with balanceAfter/outstandingBalance the same way every other repayment
        // does), with the penalty broken out separately in penaltyAmount for reporting.
        const penalty = loan.deferredInstallments > 0 ? round2(schedRow.installment * DEFERMENT_PENALTY_RATE) : 0;
        // Decrement the loan's CURRENT balance by this installment, rather than resetting to the
        // original fixed schedule's snapshot at this index — the current balance already reflects
        // any manual repayments, admin corrections or early-payoff rebates applied since the loan
        // was created, and resetting to the fixed schedule would silently discard all of that.
        const newBalance = Math.max(0, round2(num(loan.outstandingBalance) - schedRow.installment));
        await tx.loanRepayment.create({
          data: {
            loanId: loan.id,
            month,
            amount: schedRow.installment,
            principal: schedRow.principal,
            interest: schedRow.interest,
            penaltyAmount: penalty,
            balanceAfter: newBalance,
            source: "PAYROLL",
          },
        });
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            outstandingBalance: newBalance,
            status: newBalance <= 0 ? "COMPLETED" : loan.status,
            deferredInstallments: penalty > 0 ? { decrement: 1 } : undefined,
          },
        });
      }
    }

    // A loan suspended for this month just got deferred one more installment — that installment
    // will carry the 10% penalty whenever it's eventually billed after the loan resumes.
    const activeLoans = await tx.loan.findMany({
      where: { status: "ACTIVE", startMonth: { lte: month } },
      select: { id: true, suspendedFrom: true, suspendedUntil: true },
    });
    for (const loan of activeLoans) {
      if (isSuspended(loan, month)) {
        await tx.loan.update({ where: { id: loan.id }, data: { deferredInstallments: { increment: 1 } } });
      }
    }

    // Auto-resume loans whose suspension window has lapsed by this month.
    await tx.loan.updateMany({
      where: { status: "ACTIVE", suspendedUntil: { lte: month } },
      data: { suspendedFrom: null, suspendedUntil: null },
    });

    await tx.deductionScheduleRun.create({
      data: {
        month,
        postedById: ctx.userId,
        memberCount: preview.rows.length,
        totalSavings: preview.totals.savings,
        totalLoanRepayment: preview.totals.loanRepayment,
        totalDeduction: preview.totals.total,
      },
    });
  });

  await logAudit(ctx, {
    action: "SCHEDULE_POSTED",
    entityType: "DeductionScheduleRun",
    entityId: month.toISOString().slice(0, 7),
    after: preview.totals,
  });

  return previewSchedule(ctx, month);
}

export async function listPostedRuns(ctx: Ctx) {
  requirePerm(ctx, "schedule.view");
  return db.deductionScheduleRun.findMany({ orderBy: { month: "desc" } });
}
