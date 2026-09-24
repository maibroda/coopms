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

export interface ScheduleRow {
  memberId: string;
  membershipNumber: string;
  fullName: string;
  department: string | null;
  savings: number;
  loanRepayment: number;
  total: number;
  loanBreakdown: { loanId: string; amount: number }[];
}

export interface SchedulePreview {
  month: Date;
  rows: ScheduleRow[];
  totals: { savings: number; loanRepayment: number; total: number };
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
  const members = await db.member.findMany({
    where: { status: "ACTIVE", dateJoined: { lte: month } },
    include: {
      loans: { where: { status: "ACTIVE" }, include: { _count: { select: { repayments: true } } } },
    },
    orderBy: { fullName: "asc" },
  });

  const rows: ScheduleRow[] = members.map((m) => {
    const savings = num(m.monthlyContribution);
    const loanBreakdown: { loanId: string; amount: number }[] = [];
    let loanRepayment = 0;
    for (const loan of m.loans) {
      if (loan.startMonth.getTime() > month.getTime()) continue; // not disbursed yet
      if (isSuspended(loan, month)) continue;
      const paidCount = loan._count.repayments;
      if (paidCount >= loan.durationMonths) continue; // fully scheduled — should already be COMPLETED
      const calc = calcLoan(num(loan.loanAmount), num(loan.interestRate), loan.durationMonths, loan.repaymentType as RepaymentType);
      const installment = calc.schedule[paidCount]?.installment ?? 0;
      loanBreakdown.push({ loanId: loan.id, amount: installment });
      loanRepayment = round2(loanRepayment + installment);
    }
    return {
      memberId: m.id,
      membershipNumber: m.membershipNumber,
      fullName: m.fullName,
      department: m.department,
      savings,
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
        await tx.loanRepayment.create({
          data: {
            loanId: loan.id,
            month,
            amount: schedRow.installment,
            principal: schedRow.principal,
            interest: schedRow.interest,
            balanceAfter: schedRow.balanceAfter,
            source: "PAYROLL",
          },
        });
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            outstandingBalance: schedRow.balanceAfter,
            status: schedRow.balanceAfter <= 0 ? "COMPLETED" : loan.status,
          },
        });
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
