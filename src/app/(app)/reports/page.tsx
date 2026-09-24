import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { num, sum, naira } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TFoot, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function ReportsPage() {
  await requirePage("reports.view");

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
