import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { listLoansPaginated } from "@/lib/services/loans";
import { naira } from "@/lib/money";
import { periodName } from "@/lib/dates";
import { parsePage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LoanRowActions } from "@/components/forms/loan-row-actions";
import { PaginationControls } from "@/components/pagination-controls";

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await requirePage("loan.view");
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const result = await listLoansPaginated(ctx, { page, pageSize: DEFAULT_PAGE_SIZE });
  const loans = result.items;
  const canManage = ctx.role !== "MEMBER";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Loans</h1>
          <p className="text-sm text-muted-foreground">{result.total} loan(s)</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/exports/loans">
            <Button variant="outline">Export XLSX</Button>
          </a>
          <Link href="/loans/new">
            <Button>New loan</Button>
          </Link>
        </div>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Amount</TH>
              <TH>Rate</TH>
              <TH>Type</TH>
              <TH>Start</TH>
              <TH>Monthly</TH>
              <TH>Outstanding</TH>
              <TH>Status</TH>
              {canManage && <TH>Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {loans.map((l) => (
              <TR key={l.id} id={l.id}>
                <TD>
                  <Link href={`/members/${l.memberId}`} className="text-primary underline">
                    {l.member.fullName}
                  </Link>
                </TD>
                <TD>{naira(l.loanAmount)}</TD>
                <TD>{Number(l.interestRate)}%</TD>
                <TD>{l.repaymentType}</TD>
                <TD>{periodName(l.startMonth)}</TD>
                <TD>{naira(l.monthlyRepayment)}</TD>
                <TD>{naira(l.outstandingBalance)}</TD>
                <TD>
                  <StatusBadge status={l.suspendedUntil ? "SUSPENDED" : l.status} />
                </TD>
                {canManage && (
                  <TD>
                    <LoanRowActions loanId={l.id} memberId={l.memberId} suspended={!!l.suspendedUntil} status={l.status} />
                  </TD>
                )}
              </TR>
            ))}
            {loans.length === 0 && (
              <TR>
                <TD colSpan={9} className="py-8 text-center text-muted-foreground">
                  No loans on record.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <PaginationControls page={result.page} totalPages={result.totalPages} total={result.total} searchParams={{}} />
      </Card>
    </div>
  );
}
