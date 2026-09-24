import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { memberSummary, memberLedger } from "@/lib/services/members";
import { checkLoanEligibility } from "@/lib/services/loans";
import { checkPurchaseEligibility } from "@/lib/services/sales";
import { naira } from "@/lib/money";
import { fmtDate, periodName } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { StatementTable } from "@/components/statement-table";
import { MemberStatusButton } from "@/components/forms/member-status-button";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("member.view");
  const { id } = await params;
  const { member, loans, sales, totals } = await memberSummary(ctx, id);
  const [loanEligibility, purchaseEligibility, ledger] = await Promise.all([
    checkLoanEligibility(id),
    checkPurchaseEligibility(id),
    memberLedger(id),
  ]);

  return (
    <div className="space-y-6 print-area">
      <div className="flex flex-wrap items-start justify-between gap-2 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{member.fullName}</h1>
            <StatusBadge status={member.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {member.membershipNumber} · {member.department ?? "—"} · Joined {fmtDate(member.dateJoined)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/members/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/loans/new?memberId=${id}`}>
            <Button variant="outline">New loan</Button>
          </Link>
          <Link href={`/sales/new?memberId=${id}`}>
            <Button variant="outline">New purchase</Button>
          </Link>
          <MemberStatusButton
            memberId={id}
            status={member.status}
            outstandingLoans={totals.outstandingLoans}
            outstandingPurchases={totals.outstandingPurchases}
            netPayout={totals.netPosition}
          />
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Current savings" value={naira(totals.totalContributions)} />
        <Stat label="Outstanding loans" value={naira(totals.outstandingLoans)} />
        <Stat label="Outstanding purchases" value={naira(totals.outstandingPurchases)} />
        <Stat label="Total loans collected" value={naira(totals.totalLoansCollected)} />
        <Stat label="Purchases made" value={naira(totals.purchasesMade)} />
        <Stat label="Net position" value={naira(totals.netPosition)} />
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 p-4 text-sm sm:grid-cols-2">
          <p>
            Loan eligibility: can borrow up to <strong>{naira(loanEligibility.availableToBorrow)}</strong> more
            (cap of {naira(loanEligibility.maxBorrowable)} — less {naira(loanEligibility.currentOutstandingPrincipal)} already borrowed).
          </p>
          <p>
            Purchase eligibility: can take up to <strong>{naira(purchaseEligibility.availableCapacity)}</strong> more
            in credit purchases (savings less {naira(purchaseEligibility.outstandingPurchases)} outstanding).
          </p>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Bank details</CardTitle>
          <p className="text-xs text-muted-foreground">Used for loan disbursement and (later) dividend payments.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 p-4 text-sm sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Bank:</span> {member.bankName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Account number:</span> {member.bankAccountNumber ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Account name:</span> {member.bankAccountName ?? "—"}
          </p>
        </CardContent>
      </Card>

      <StatementTable ledger={ledger} />

      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Loan amount</TH>
              <TH>Rate</TH>
              <TH>Type</TH>
              <TH>Start</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {loans.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link href={`/loans#${l.id}`} className="text-primary underline">
                    {naira(l.loanAmount)}
                  </Link>
                </TD>
                <TD>{Number(l.interestRate)}%</TD>
                <TD>{l.repaymentType}</TD>
                <TD>{periodName(l.startMonth)}</TD>
                <TD>{naira(l.monthlyRepayment)}</TD>
                <TD>{naira(l.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={l.suspendedUntil ? "SUSPENDED" : l.status} />
                </TD>
              </TR>
            ))}
            {loans.length === 0 && (
              <TR>
                <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                  No loans on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product purchases</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>Category</TH>
              <TH>Cost</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((s) => (
              <TR key={s.id}>
                <TD>{s.itemName}</TD>
                <TD>{s.category}</TD>
                <TD>{naira(s.cost)}</TD>
                <TD>{naira(s.monthlyDeduction)}</TD>
                <TD>{naira(s.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={s.status} />
                </TD>
              </TR>
            ))}
            {sales.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  No product purchases on record.
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
