import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { num, sum, naira } from "@/lib/money";
import { monthStart, periodName } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/dashboard-charts";

async function kpis() {
  const now = new Date();
  const thisMonth = monthStart(now.getUTCFullYear(), now.getUTCMonth() + 1);

  const [memberCount, members, contributions, loans, sales, loanRepayments] = await Promise.all([
    db.member.count({ where: { status: "ACTIVE" } }),
    db.member.findMany({ select: { openingSavingsBalance: true, openingLoanBalance: true } }),
    db.contribution.findMany({ select: { amount: true } }),
    db.loan.findMany({
      select: {
        loanAmount: true,
        outstandingBalance: true,
        totalInterest: true,
        status: true,
        durationMonths: true,
        suspendedFrom: true,
        suspendedUntil: true,
        _count: { select: { repayments: true } },
        member: { select: { fullName: true } },
      },
    }),
    db.productSale.findMany({ select: { cost: true, totalInterest: true, outstandingBalance: true, status: true } }),
    db.loanRepayment.findMany({ select: { interest: true, amount: true } }),
  ]);

  const openingSavings = sum(members.map((m) => num(m.openingSavingsBalance)));
  const openingLoans = sum(members.map((m) => num(m.openingLoanBalance)));
  const totalContributions = sum([openingSavings, ...contributions.map((c) => num(c.amount))]);
  // PENDING loans/sales haven't actually been disbursed yet, and REJECTED ones never will be —
  // both are excluded here, same as everywhere else outstanding/disbursed totals are computed.
  const disbursedLoans = loans.filter((l) => l.status !== "PENDING" && l.status !== "REJECTED");
  const disbursedSales = sales.filter((s) => s.status !== "PENDING" && s.status !== "REJECTED");
  const totalLoansDisbursed = sum([openingLoans, ...disbursedLoans.map((l) => num(l.loanAmount))]);
  const outstandingLoans = sum(loans.filter((l) => l.status === "ACTIVE").map((l) => num(l.outstandingBalance)));
  const totalSalesValue = sum(disbursedSales.map((s) => num(s.cost)));
  const loanInterestEarned = sum(loanRepayments.map((r) => num(r.interest)));
  const totalRepaymentsCollected = sum(loanRepayments.map((r) => num(r.amount)));
  // Cash actually in the pool: savings in (incl. balances migrated from manual records), minus
  // principal paid out to borrowers, plus what's been repaid so far.
  const cashAvailable = totalContributions - totalLoansDisbursed + totalRepaymentsCollected;

  // "One installment left" is based on installments actually posted so far, not the loan's
  // originally scheduled end date — a suspended loan's schedule shifts later, so the static
  // end date would otherwise flag it as "ending" long after its real final payment moved.
  const endingNextMonth = loans.filter(
    (l) => l.status === "ACTIVE" && !l.suspendedUntil && l.durationMonths - l._count.repayments === 1,
  );

  return {
    memberCount,
    totalContributions,
    totalLoansDisbursed,
    outstandingLoans,
    totalSalesValue,
    loanInterestEarned,
    cashAvailable,
    activeLoanCount: loans.filter((l) => l.status === "ACTIVE").length,
    activeSaleCount: sales.filter((s) => s.status === "ACTIVE").length,
    endingSoon: endingNextMonth,
    period: periodName(thisMonth),
  };
}

async function chartData() {
  const [runs, loans, members, contributions] = await Promise.all([
    db.deductionScheduleRun.findMany({ orderBy: { month: "asc" }, select: { month: true, totalSavings: true } }),
    db.loan.groupBy({ by: ["status"], _count: { _all: true } }),
    db.member.findMany({ select: { id: true, department: true, openingSavingsBalance: true } }),
    db.contribution.findMany({ select: { memberId: true, amount: true } }),
  ]);

  const contributionsGrowth = runs.map((r) => ({ month: periodName(r.month), savings: num(r.totalSavings) }));
  const loanPortfolio = loans.map((l) => ({ status: l.status, count: l._count._all }));

  const byDept = new Map<string, number>();
  const openingByMember = new Map(members.map((m) => [m.id, num(m.openingSavingsBalance)]));
  for (const m of members) byDept.set(m.department ?? "Unassigned", (byDept.get(m.department ?? "Unassigned") ?? 0) + (openingByMember.get(m.id) ?? 0));
  const memberDept = new Map(members.map((m) => [m.id, m.department ?? "Unassigned"]));
  for (const c of contributions) {
    const dept = memberDept.get(c.memberId) ?? "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + num(c.amount));
  }
  const departmentSavings = [...byDept.entries()]
    .map(([department, savings]) => ({ department, savings: Math.round(savings * 100) / 100 }))
    .sort((a, b) => b.savings - a.savings);

  return { contributionsGrowth, loanPortfolio, departmentSavings };
}

export default async function DashboardPage() {
  await requirePage("dashboard.view");
  const [k, charts] = await Promise.all([kpis(), chartData()]);

  const stats = [
    { label: "Total Members", value: k.memberCount.toLocaleString() },
    { label: "Total Contributions", value: naira(k.totalContributions) },
    { label: "Total Loans Disbursed", value: naira(k.totalLoansDisbursed) },
    { label: "Outstanding Loans", value: naira(k.outstandingLoans) },
    { label: "Total Sales", value: naira(k.totalSalesValue) },
    { label: "Loan Interest Income", value: naira(k.loanInterestEarned) },
    { label: "Cash Available", value: naira(k.cashAvailable) },
    { label: "Active Loans / Sales", value: `${k.activeLoanCount} / ${k.activeSaleCount}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground">Cooperative summary as of {k.period}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardCharts {...charts} />

      <Card>
        <CardHeader>
          <CardTitle>Alerts — loans completing this period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {k.endingSoon.length === 0 && <p className="text-sm text-muted-foreground">No loans due to complete this month.</p>}
          {k.endingSoon.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{l.member.fullName}</span>
              <Badge tone="amber">Final installment due</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href="/members" className="text-sm text-primary underline">
          Manage members
        </Link>
        <Link href="/schedule" className="text-sm text-primary underline">
          Generate this month&apos;s deduction schedule
        </Link>
      </div>
    </div>
  );
}
