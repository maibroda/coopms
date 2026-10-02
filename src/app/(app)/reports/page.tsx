import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { num, sum, naira } from "@/lib/money";
import { fmtDate, periodName, fromMonthInput } from "@/lib/dates";
import {
  getLoanInterestReport,
  getSalesInterestReport,
  getSavingsBreakdown,
  getLoanRepaymentPeriods,
  getIrregularRepaymentReport,
} from "@/lib/services/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TFoot, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonthDropdown } from "@/components/month-dropdown";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requirePage("reports.view");
  const { from: fromParam, to: toParam } = await searchParams;
  const from = fromParam ? `${fromParam}-01` : undefined;
  const to = toParam ? fromMonthInput(toParam).toISOString().slice(0, 10) : undefined;

  const [contributions, loans, sales, loanRepayments] = await Promise.all([
    db.contribution.findMany({ include: { member: true } }),
    db.loan.findMany(),
    db.productSale.findMany(),
    db.loanRepayment.findMany(),
  ]);

  const byMember = new Map<string, { name: string; total: number }>();
  for (const c of contributions) {
    const cur = byMember.get(c.memberId) ?? { name: c.member.fullName, total: 0 };
    cur.total = sum([cur.total, num(c.amount)]);
    byMember.set(c.memberId, cur);
  }

  // PENDING loans/sales haven't actually been disbursed yet, and REJECTED ones never will be.
  const disbursedLoans = loans.filter((l) => l.status !== "PENDING" && l.status !== "REJECTED");
  const disbursedSales = sales.filter((s) => s.status !== "PENDING" && s.status !== "REJECTED");
  const totalLoansGranted = disbursedLoans.length;
  const totalPrincipal = sum(disbursedLoans.map((l) => num(l.loanAmount)));
  const interestEarned = sum(loanRepayments.map((r) => num(r.interest)));
  const outstandingPrincipal = sum(loans.filter((l) => l.status === "ACTIVE").map((l) => num(l.outstandingBalance)));

  const byCategory = new Map<string, { salesValue: number; interestEarned: number }>();
  for (const s of disbursedSales) {
    const cur = byCategory.get(s.category) ?? { salesValue: 0, interestEarned: 0 };
    cur.salesValue = sum([cur.salesValue, num(s.cost)]);
    cur.interestEarned = sum([cur.interestEarned, num(s.totalInterest)]);
    byCategory.set(s.category, cur);
  }

  const [loanInterest, salesInterest, savings, loanPeriods, irregular] = await Promise.all([
    getLoanInterestReport(ctx, { from, to }),
    getSalesInterestReport(ctx, { from, to }),
    getSavingsBreakdown(ctx),
    getLoanRepaymentPeriods(ctx),
    getIrregularRepaymentReport(ctx),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Financial Reports</h1>
        <a href="/api/exports/reports">
          <Button variant="outline">Export XLSX</Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annual Loan Report</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Stat label="Loans granted" value={String(totalLoansGranted)} />
          <Stat label="Total principal" value={naira(totalPrincipal)} />
          <Stat label="Interest earned (posted)" value={naira(interestEarned)} />
          <Stat label="Outstanding principal" value={naira(outstandingPrincipal)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interest income — filtered by period</CardTitle>
          <p className="text-xs text-muted-foreground">
            Interest actually collected (posted repayments), broken out by month and by year. Leave the range
            blank to see all-time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <form className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/80">From</label>
              <MonthDropdown name="from" defaultValue={fromParam} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/80">To</label>
              <MonthDropdown name="to" defaultValue={toParam} />
            </div>
            <Button variant="outline" type="submit">
              Apply
            </Button>
            {(fromParam || toParam) && (
              <a href="/reports">
                <Button variant="ghost" type="button">
                  Clear
                </Button>
              </a>
            )}
          </form>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Loan interest (period)" value={naira(loanInterest.total)} />
            <Stat label="Deferment penalties (period)" value={naira(loanInterest.totalPenalty)} />
            <Stat label="Sales interest (period)" value={naira(salesInterest.total)} />
            <Stat label="Total interest income (period)" value={naira(loanInterest.total + salesInterest.total)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Loan interest — by month</p>
              <Table>
                <THead>
                  <TR>
                    <TH>Month</TH>
                    <TH>Interest</TH>
                    <TH>Penalty</TH>
                  </TR>
                </THead>
                <TBody>
                  {loanInterest.monthly.map((m) => (
                    <TR key={m.month}>
                      <TD>{m.label}</TD>
                      <TD>{naira(m.interest)}</TD>
                      <TD>{m.penalty ? naira(m.penalty) : "—"}</TD>
                    </TR>
                  ))}
                  {loanInterest.monthly.length === 0 && (
                    <TR>
                      <TD colSpan={3} className="py-4 text-center text-muted-foreground">
                        No loan interest posted in this period.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Loan interest — by year</p>
              <Table>
                <THead>
                  <TR>
                    <TH>Year</TH>
                    <TH>Interest</TH>
                    <TH>Penalty</TH>
                  </TR>
                </THead>
                <TBody>
                  {loanInterest.yearly.map((y) => (
                    <TR key={y.year}>
                      <TD>{y.year}</TD>
                      <TD>{naira(y.interest)}</TD>
                      <TD>{y.penalty ? naira(y.penalty) : "—"}</TD>
                    </TR>
                  ))}
                  {loanInterest.yearly.length === 0 && (
                    <TR>
                      <TD colSpan={3} className="py-4 text-center text-muted-foreground">
                        No loan interest posted in this period.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Sales interest — by month</p>
              <Table>
                <THead>
                  <TR>
                    <TH>Month</TH>
                    <TH>Interest</TH>
                  </TR>
                </THead>
                <TBody>
                  {salesInterest.monthly.map((m) => (
                    <TR key={m.month}>
                      <TD>{m.label}</TD>
                      <TD>{naira(m.interest)}</TD>
                    </TR>
                  ))}
                  {salesInterest.monthly.length === 0 && (
                    <TR>
                      <TD colSpan={2} className="py-4 text-center text-muted-foreground">
                        No sales interest collected in this period.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Sales interest — by year</p>
              <Table>
                <THead>
                  <TR>
                    <TH>Year</TH>
                    <TH>Interest</TH>
                  </TR>
                </THead>
                <TBody>
                  {salesInterest.yearly.map((y) => (
                    <TR key={y.year}>
                      <TD>{y.year}</TD>
                      <TD>{naira(y.interest)}</TD>
                    </TR>
                  ))}
                  {salesInterest.yearly.length === 0 && (
                    <TR>
                      <TD colSpan={2} className="py-4 text-center text-muted-foreground">
                        No sales interest collected in this period.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Report — by category</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Category</TH>
              <TH>Sales value</TH>
              <TH>Interest earned</TH>
            </TR>
          </THead>
          <TBody>
            {[...byCategory.entries()].map(([cat, v]) => (
              <TR key={cat}>
                <TD>{cat}</TD>
                <TD>{naira(v.salesValue)}</TD>
                <TD>{naira(v.interestEarned)}</TD>
              </TR>
            ))}
            {byCategory.size === 0 && (
              <TR>
                <TD colSpan={3} className="py-6 text-center text-muted-foreground">
                  No product sales recorded.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Savings by department</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Department</TH>
                <TH>Savings</TH>
              </TR>
            </THead>
            <TBody>
              {savings.byDepartment.map((d) => (
                <TR key={d.label}>
                  <TD>{d.label}</TD>
                  <TD>{naira(d.savings)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Savings by region</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Region</TH>
                <TH>Savings</TH>
              </TR>
            </THead>
            <TBody>
              {savings.byRegion.map((d) => (
                <TR key={d.label}>
                  <TD>{d.label}</TD>
                  <TD>{naira(d.savings)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan repayment periods</CardTitle>
          <p className="text-xs text-muted-foreground">When each loan started and when it&apos;s due to end.</p>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Amount</TH>
              <TH>Start</TH>
              <TH>End</TH>
              <TH>Installments paid</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {loanPeriods.map((l) => (
              <TR key={l.loanId}>
                <TD>{l.memberName}</TD>
                <TD>{naira(l.loanAmount)}</TD>
                <TD>{periodName(l.startMonth)}</TD>
                <TD>{periodName(l.endMonth)}</TD>
                <TD>
                  {l.installmentsPaid} / {l.durationMonths}
                </TD>
                <TD>
                  <StatusBadge status={l.status} />
                </TD>
              </TR>
            ))}
            {loanPeriods.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  No loans on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Irregular repayment report</CardTitle>
          <p className="text-xs text-muted-foreground">
            Loans with direct/manual repayments showing real inconsistency in amount — partial payments, skipped
            months, lump sums of varying size — rather than a steady scheduled amount. Often ex-members whose
            collection has become ad hoc.
          </p>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Status</TH>
              <TH>Outstanding</TH>
              <TH>Payments recorded</TH>
              <TH>Amounts</TH>
            </TR>
          </THead>
          <TBody>
            {irregular.map((r) => (
              <TR key={r.loanId}>
                <TD>{r.memberName}</TD>
                <TD>
                  <StatusBadge status={r.memberStatus} />
                </TD>
                <TD>{naira(r.outstandingBalance)}</TD>
                <TD>{r.monthsWithPayment}</TD>
                <TD className="text-xs text-muted-foreground">
                  {r.payments.map((p) => `${fmtDate(p.month)}: ${naira(p.amount)}`).join(" · ")}
                </TD>
              </TR>
            ))}
            {irregular.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                  No loans with irregular repayment patterns found.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contribution Report — per member (all-time)</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Total contributions</TH>
            </TR>
          </THead>
          <TBody>
            {[...byMember.entries()].map(([id, v]) => (
              <TR key={id}>
                <TD>{v.name}</TD>
                <TD>{naira(v.total)}</TD>
              </TR>
            ))}
            {byMember.size === 0 && (
              <TR>
                <TD colSpan={2} className="py-6 text-center text-muted-foreground">
                  No contributions posted yet.
                </TD>
              </TR>
            )}
          </TBody>
          <TFoot>
            <TR>
              <TD>Total</TD>
              <TD>{naira(sum([...byMember.values()].map((v) => v.total)))}</TD>
            </TR>
          </TFoot>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Report</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          <Stat label="Loan interest" value={naira(interestEarned)} />
          <Stat label="Sales interest (accrued)" value={naira(sum(disbursedSales.map((s) => num(s.totalInterest))))} />
          <Stat label="Total income" value={naira(sum([interestEarned, sum(disbursedSales.map((s) => num(s.totalInterest)))]))} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
