import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { memberLedger } from "@/lib/services/members";
import { listMyPaymentClaims } from "@/lib/services/paymentClaims";
import { num, sum, naira } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { StatementTable } from "@/components/statement-table";

function NotLinked({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-12 text-center">
      <h1 className="text-xl font-semibold">No membership linked yet</h1>
      <p className="text-sm text-muted-foreground">
        Your account ({email}) isn&apos;t linked to a cooperative membership record yet. Contact your Treasurer to
        have your membership profile connected to this login.
      </p>
    </div>
  );
}

export default async function MeStatementPage() {
  const ctx = await requirePage("self.view");
  if (!ctx.memberId) return <NotLinked email={ctx.email} />;

  const member = await db.member.findUnique({
    where: { id: ctx.memberId },
    include: {
      contributions: { orderBy: { month: "asc" } },
      loans: { orderBy: { createdAt: "desc" } },
      productSales: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!member) return <NotLinked email={ctx.email} />;

  const ledger = await memberLedger(ctx.memberId);
  const claims = await listMyPaymentClaims(ctx);

  const savings = sum([num(member.openingSavingsBalance), ...member.contributions.map((c) => num(c.amount))]);
  const outstandingLoans = sum([
    num(member.openingLoanBalance),
    ...member.loans.filter((l) => l.status === "ACTIVE").map((l) => num(l.outstandingBalance)),
  ]);
  const outstandingPurchases = sum(member.productSales.filter((s) => s.status === "ACTIVE").map((s) => num(s.outstandingBalance)));

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-start justify-between no-print">
        <div>
          <h1 className="text-xl font-semibold">My Statement</h1>
          <p className="text-sm text-muted-foreground">
            {member.membershipNumber} · {member.fullName} · Joined {fmtDate(member.dateJoined)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/me/request-loan">
            <Button variant="outline">Request a loan</Button>
          </Link>
          <Link href="/me/request-purchase">
            <Button variant="outline">Request a purchase</Button>
          </Link>
          <Link href="/me/report-payment">
            <Button variant="outline">Report a payment</Button>
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current savings" value={naira(savings)} />
        <Stat label="Outstanding loans" value={naira(outstandingLoans)} />
        <Stat label="Outstanding purchases" value={naira(outstandingPurchases)} />
        <Stat label="Net position" value={naira(savings - outstandingLoans - outstandingPurchases)} />
      </div>

      <StatementTable ledger={ledger} />

      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Amount</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {member.loans.map((l) => (
              <TR key={l.id}>
                <TD>{naira(l.loanAmount)}</TD>
                <TD>{naira(l.monthlyRepayment)}</TD>
                <TD>{naira(l.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={l.suspendedUntil ? "SUSPENDED" : l.status} />
                </TD>
              </TR>
            ))}
            {member.loans.length === 0 && (
              <TR>
                <TD colSpan={4} className="py-6 text-center text-muted-foreground">
                  No loans on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchases</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {member.productSales.map((s) => (
              <TR key={s.id}>
                <TD>{s.itemName}</TD>
                <TD>{naira(s.monthlyDeduction)}</TD>
                <TD>{naira(s.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={s.status} />
                </TD>
              </TR>
            ))}
            {member.productSales.length === 0 && (
              <TR>
                <TD colSpan={4} className="py-6 text-center text-muted-foreground">
                  No purchases on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>My reported payments</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Reported</TH>
              <TH>For</TH>
              <TH>Amount</TH>
              <TH>Paid on</TH>
              <TH>Reference</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {claims.map((c) => (
              <TR key={c.id}>
                <TD>{fmtDate(c.submittedAt)}</TD>
                <TD>{c.target === "LOAN" ? `Loan (${naira(c.loan?.loanAmount ?? 0)})` : "Savings"}</TD>
                <TD>{naira(c.amount)}</TD>
                <TD>{fmtDate(c.paidOn)}</TD>
                <TD>{c.reference}</TD>
                <TD>
                  <StatusBadge status={c.status} />
                  {c.status === "REJECTED" && c.rejectionReason && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.rejectionReason}</p>
                  )}
                </TD>
              </TR>
            ))}
            {claims.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  No payments reported yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
