import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { periodName } from "@/lib/dates";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx) {
  if (!can(ctx.role, "reports.view")) throw new ForbiddenError("reports.view");
}

export interface PeriodFilter {
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

function dateRangeWhere(filter: PeriodFilter) {
  const where: { gte?: Date; lte?: Date } = {};
  if (filter.from) where.gte = new Date(filter.from);
  if (filter.to) where.lte = new Date(filter.to);
  return Object.keys(where).length ? where : undefined;
}

export interface InterestByPeriod {
  monthly: { month: string; label: string; interest: number; penalty: number }[];
  yearly: { year: number; interest: number; penalty: number }[];
  total: number;
  totalPenalty: number;
}

/** Loan interest actually collected (posted repayments), broken out monthly and yearly, with an
 * optional date-range filter — this is the "interest deducted for a period" report. Deferment
 * penalties are reported alongside but kept separate from plain interest. */
export async function getLoanInterestReport(ctx: Ctx, filter: PeriodFilter = {}): Promise<InterestByPeriod> {
  requirePerm(ctx);
  const repayments = await db.loanRepayment.findMany({
    where: { month: dateRangeWhere(filter) },
    select: { month: true, interest: true, penaltyAmount: true },
  });
  return summarizeByPeriod(repayments.map((r) => ({ month: r.month, interest: num(r.interest), penalty: num(r.penaltyAmount) })));
}

/** Same shape as getLoanInterestReport, but for product-sale interest (allocated proportionally
 * to each direct payment — see recordSaleRepayment). Sales have no deferment penalty concept. */
export async function getSalesInterestReport(ctx: Ctx, filter: PeriodFilter = {}): Promise<InterestByPeriod> {
  requirePerm(ctx);
  const repayments = await db.productRepayment.findMany({
    where: { month: dateRangeWhere(filter) },
    select: { month: true, interest: true },
  });
  return summarizeByPeriod(repayments.map((r) => ({ month: r.month, interest: num(r.interest), penalty: 0 })));
}

function summarizeByPeriod(rows: { month: Date; interest: number; penalty: number }[]): InterestByPeriod {
  const monthlyMap = new Map<string, { month: string; label: string; interest: number; penalty: number }>();
  const yearlyMap = new Map<number, { year: number; interest: number; penalty: number }>();

  for (const r of rows) {
    const monthKey = r.month.toISOString().slice(0, 7);
    const year = r.month.getUTCFullYear();

    const m = monthlyMap.get(monthKey) ?? { month: monthKey, label: periodName(r.month), interest: 0, penalty: 0 };
    m.interest = round2(m.interest + r.interest);
    m.penalty = round2(m.penalty + r.penalty);
    monthlyMap.set(monthKey, m);

    const y = yearlyMap.get(year) ?? { year, interest: 0, penalty: 0 };
    y.interest = round2(y.interest + r.interest);
    y.penalty = round2(y.penalty + r.penalty);
    yearlyMap.set(year, y);
  }

  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const yearly = [...yearlyMap.values()].sort((a, b) => a.year - b.year);

  return {
    monthly,
    yearly,
    total: round2(sum(rows.map((r) => r.interest))),
    totalPenalty: round2(sum(rows.map((r) => r.penalty))),
  };
}

const REGION_LABELS: Record<string, string> = {
  SOUTH_WEST: "South West",
  LAGOS: "Lagos",
  NORTH_CENTRAL: "North Central",
  NORTH_EAST: "North East",
  SOUTH_SOUTH: "South South",
  SOUTH_EAST: "South East",
};

export interface SavingsBreakdown {
  byDepartment: { label: string; savings: number }[];
  byRegion: { label: string; savings: number }[];
}

/** Total savings (opening balance + all posted contributions) broken out by department and,
 * separately, by region — two independent cuts of the same figures, not combined into one. */
export async function getSavingsBreakdown(ctx: Ctx): Promise<SavingsBreakdown> {
  requirePerm(ctx);
  const [members, contributions] = await Promise.all([
    db.member.findMany({ select: { id: true, department: true, region: true, openingSavingsBalance: true } }),
    db.contribution.findMany({ select: { memberId: true, amount: true } }),
  ]);

  const byDept = new Map<string, number>();
  const byRegion = new Map<string, number>();
  const deptByMember = new Map<string, string>();
  const regionByMember = new Map<string, string>();

  for (const m of members) {
    const dept = m.department ?? "Unassigned";
    const region = REGION_LABELS[m.region] ?? m.region;
    deptByMember.set(m.id, dept);
    regionByMember.set(m.id, region);
    byDept.set(dept, round2((byDept.get(dept) ?? 0) + num(m.openingSavingsBalance)));
    byRegion.set(region, round2((byRegion.get(region) ?? 0) + num(m.openingSavingsBalance)));
  }
  for (const c of contributions) {
    const dept = deptByMember.get(c.memberId) ?? "Unassigned";
    const region = regionByMember.get(c.memberId) ?? "Unassigned";
    byDept.set(dept, round2((byDept.get(dept) ?? 0) + num(c.amount)));
    byRegion.set(region, round2((byRegion.get(region) ?? 0) + num(c.amount)));
  }

  return {
    byDepartment: [...byDept.entries()].map(([label, savings]) => ({ label, savings })).sort((a, b) => b.savings - a.savings),
    byRegion: [...byRegion.entries()].map(([label, savings]) => ({ label, savings })).sort((a, b) => b.savings - a.savings),
  };
}

export interface LoanPeriodRow {
  loanId: string;
  memberName: string;
  membershipNumber: string;
  loanAmount: number;
  startMonth: Date;
  endMonth: Date;
  status: string;
  installmentsPaid: number;
  durationMonths: number;
}

/** When each loan started and when it's due to end — the full book, not just active ones, so
 * completed/defaulted loans' actual repayment windows are visible too. */
export async function getLoanRepaymentPeriods(ctx: Ctx, opts: { memberId?: string } = {}): Promise<LoanPeriodRow[]> {
  requirePerm(ctx);
  const loans = await db.loan.findMany({
    where: { memberId: opts.memberId, status: { notIn: ["PENDING", "REJECTED"] } },
    include: { member: { select: { fullName: true, membershipNumber: true } }, _count: { select: { repayments: true } } },
    orderBy: { startMonth: "asc" },
  });
  return loans.map((l) => ({
    loanId: l.id,
    memberName: l.member.fullName,
    membershipNumber: l.member.membershipNumber,
    loanAmount: num(l.loanAmount),
    startMonth: l.startMonth,
    endMonth: l.endMonth,
    status: l.status,
    installmentsPaid: l._count.repayments,
    durationMonths: l.durationMonths,
  }));
}

export interface IrregularRepaymentRow {
  memberId: string;
  memberName: string;
  membershipNumber: string;
  memberStatus: string;
  loanId: string;
  outstandingBalance: number;
  payments: { month: Date; amount: number }[];
  monthsWithPayment: number;
  monthsSincePosted: number;
  // Coefficient of variation of payment amounts — higher means more erratic/inconsistent.
  variability: number;
}

/**
 * Members (often ex-members / INACTIVE, but not only them) whose loan repayments have been
 * inconsistent — a mix of partial payments and skipped months — rather than a steady scheduled
 * amount. Flags any active loan with manual (direct, not payroll) repayments showing real
 * variation in amount, which is the signature of exactly this kind of irregular collection.
 */
export async function getIrregularRepaymentReport(ctx: Ctx): Promise<IrregularRepaymentRow[]> {
  requirePerm(ctx);
  const loans = await db.loan.findMany({
    where: { status: "ACTIVE", repayments: { some: { source: "MANUAL" } } },
    include: {
      member: { select: { id: true, fullName: true, membershipNumber: true, status: true } },
      repayments: { where: { source: "MANUAL" }, orderBy: { month: "asc" }, select: { month: true, amount: true } },
    },
  });

  const rows: IrregularRepaymentRow[] = loans
    .map((l) => {
      const amounts = l.repayments.map((r) => num(r.amount));
      const mean = amounts.length ? sum(amounts) / amounts.length : 0;
      const variance = amounts.length ? amounts.reduce((a, v) => a + (v - mean) ** 2, 0) / amounts.length : 0;
      const stdDev = Math.sqrt(variance);
      const variability = mean > 0 ? round2(stdDev / mean) : 0;
      return {
        memberId: l.member.id,
        memberName: l.member.fullName,
        membershipNumber: l.member.membershipNumber,
        memberStatus: l.member.status,
        loanId: l.id,
        outstandingBalance: num(l.outstandingBalance),
        payments: l.repayments.map((r) => ({ month: r.month, amount: num(r.amount) })),
        monthsWithPayment: l.repayments.length,
        monthsSincePosted: l.repayments.length,
        variability,
      };
    })
    // Only genuinely irregular patterns — some real spread in payment amounts, not just one or
    // two lump-sum payments that happen to differ trivially.
    .filter((r) => r.monthsWithPayment >= 2 && r.variability > 0.15)
    .sort((a, b) => b.variability - a.variability);

  return rows;
}
