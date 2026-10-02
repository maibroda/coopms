import { naira } from "@/lib/money";
import { periodName } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TFoot, TR, TH, TD } from "@/components/ui/table";
import type { MemberLedger } from "@/lib/services/members";

export function StatementTable({ ledger }: { ledger: MemberLedger }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement — monthly activity</CardTitle>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH>Month</TH>
            <TH>Savings in</TH>
            <TH>Loan granted (principal)</TH>
            <TH>Loan interest</TH>
            <TH>Loan repayment</TH>
            <TH>Savings balance</TH>
            <TH>Loan balance</TH>
          </TR>
        </THead>
        <TBody>
          <TR className="bg-muted/40">
            <TD className="font-medium">Balance brought forward</TD>
            <TD>—</TD>
            <TD>—</TD>
            <TD>—</TD>
            <TD>—</TD>
            <TD className="font-medium">{naira(ledger.openingSavingsBalance)}</TD>
            <TD className="font-medium">{naira(ledger.openingLoanBalance)}</TD>
          </TR>
          {ledger.rows.map((r) => (
            <TR key={r.month.toISOString()}>
              <TD>{periodName(r.month)}</TD>
              <TD>{r.savingsIn ? naira(r.savingsIn) : "—"}</TD>
              <TD>{r.loanGranted ? naira(r.loanGranted) : "—"}</TD>
              <TD>{r.loanInterestGranted ? naira(r.loanInterestGranted) : "—"}</TD>
              <TD>{r.loanRepayment ? naira(r.loanRepayment) : "—"}</TD>
              <TD>{naira(r.savingsBalance)}</TD>
              <TD>{naira(r.loanBalance)}</TD>
            </TR>
          ))}
          {ledger.rows.length === 0 && (
            <TR>
              <TD colSpan={7} className="py-6 text-center text-muted-foreground">
                No activity posted yet.
              </TD>
            </TR>
          )}
        </TBody>
        <TFoot>
          <TR>
            <TD colSpan={5}>Closing balance</TD>
            <TD>{naira(ledger.closingSavingsBalance)}</TD>
            <TD>{naira(ledger.closingLoanBalance)}</TD>
          </TR>
        </TFoot>
      </Table>
      <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
        Loan granted shows principal only; loan interest is reported separately. The loan balance still reconciles
        against the outstanding balance shown elsewhere, which covers principal and interest together. Product
        purchases are tracked separately and are not shown here.
      </CardContent>
    </Card>
  );
}
