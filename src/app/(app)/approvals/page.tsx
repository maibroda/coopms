import { requirePage } from "@/lib/auth/session";
import { listPendingLoans } from "@/lib/services/loans";
import { listPendingSales } from "@/lib/services/sales";
import { listPendingPaymentClaims } from "@/lib/services/paymentClaims";
import { approveLoanAction, rejectLoanAction } from "@/app/actions/loans";
import { approveSaleAction, rejectSaleAction } from "@/app/actions/sales";
import { confirmPaymentClaimAction, rejectPaymentClaimAction } from "@/app/actions/paymentClaims";
import { naira } from "@/lib/money";
import { periodName, fmtDate } from "@/lib/dates";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ApproveRejectButtons } from "@/components/forms/approve-reject-buttons";

export default async function ApprovalsPage() {
  const ctx = await requirePage("approvals.manage");
  const [loans, sales, claims] = await Promise.all([
    listPendingLoans(ctx),
    listPendingSales(ctx),
    listPendingPaymentClaims(ctx),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Loan and purchase requests, and member-reported direct payments, all wait here until an Admin or
          Treasurer (other than whoever requested it) reviews them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending loans ({loans.length})</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Amount</TH>
              <TH>Rate</TH>
              <TH>Type</TH>
              <TH>Start</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loans.map((l) => (
              <TR key={l.id}>
                <TD>
                  {l.member.fullName}
                  {l.isExceptionRequest && (
                    <div className="mt-1">
                      <Badge tone="amber">Exception — Admin only</Badge>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{l.exceptionReason}</p>
                    </div>
                  )}
                </TD>
                <TD>{naira(l.loanAmount)}</TD>
                <TD>{Number(l.interestRate)}%</TD>
                <TD>{l.repaymentType}</TD>
                <TD>{periodName(l.startMonth)}</TD>
                <TD>
                  <ApproveRejectButtons onApprove={approveLoanAction.bind(null, l.id)} onReject={rejectLoanAction.bind(null, l.id)} />
                </TD>
              </TR>
            ))}
            {loans.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nothing pending.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending purchases ({sales.length})</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Item</TH>
              <TH>Cost</TH>
              <TH>Start</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((s) => (
              <TR key={s.id}>
                <TD>
                  {s.member.fullName}
                  {s.isExceptionRequest && (
                    <div className="mt-1">
                      <Badge tone="amber">Exception — Admin only</Badge>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{s.exceptionReason}</p>
                    </div>
                  )}
                </TD>
                <TD>{s.itemName}</TD>
                <TD>{naira(s.cost)}</TD>
                <TD>{periodName(s.startMonth)}</TD>
                <TD>
                  <ApproveRejectButtons onApprove={approveSaleAction.bind(null, s.id)} onReject={rejectSaleAction.bind(null, s.id)} />
                </TD>
              </TR>
            ))}
            {sales.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-6 text-center text-muted-foreground">
                  Nothing pending.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending direct payments ({claims.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Verify each against the cooperative&apos;s bank statement before confirming.
          </p>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>For</TH>
              <TH>Amount</TH>
              <TH>Paid on</TH>
              <TH>Reference</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {claims.map((c) => (
              <TR key={c.id}>
                <TD>{c.member.fullName}</TD>
                <TD>{c.target === "LOAN" ? `Loan (${naira(c.loan?.loanAmount ?? 0)})` : "Savings"}</TD>
                <TD>{naira(c.amount)}</TD>
                <TD>{fmtDate(c.paidOn)}</TD>
                <TD>{c.reference}</TD>
                <TD>
                  <ApproveRejectButtons
                    onApprove={confirmPaymentClaimAction.bind(null, c.id)}
                    onReject={rejectPaymentClaimAction.bind(null, c.id)}
                  />
                </TD>
              </TR>
            ))}
            {claims.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nothing pending.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
