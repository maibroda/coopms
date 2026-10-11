import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { getDeclaration, listAllocations } from "@/lib/services/dividends";
import { can } from "@/lib/auth/permissions";
import { naira } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { parsePage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/pagination-controls";
import { DeclarationActions } from "@/components/forms/declaration-actions";

function pct(n: unknown) {
  return `${(Number(n) * 100).toFixed(2)}%`;
}

export default async function DividendDeclarationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requirePage("dividend.view");
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const [declaration, result] = await Promise.all([
    getDeclaration(ctx, id),
    listAllocations(ctx, id, { page, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{declaration.year} Dividend Declaration</h1>
            <StatusBadge status={declaration.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Declared surplus: {naira(declaration.declaredSurplus)}
            {declaration.approvedAt && <> · Approved {fmtDate(declaration.approvedAt)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dividends" className="text-sm text-primary underline">
            All declarations
          </Link>
          <a href={`/api/exports/dividends/${declaration.id}`}>
            <Button variant="outline" size="sm">
              Export XLSX
            </Button>
          </a>
          {can(ctx.role, "dividend.manage") && <DeclarationActions id={declaration.id} status={declaration.status} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disposal of surplus</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Table>
            <THead>
              <TR>
                <TH>Appropriation</TH>
                <TH>Rate</TH>
                <TH>Amount</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD>Reserve fund</TD>
                <TD>{pct(declaration.reserveFundRate)}</TD>
                <TD>{naira(declaration.reserveFundAmount)}</TD>
              </TR>
              <TR>
                <TD>Education fund</TD>
                <TD>{pct(declaration.educationFundRate)}</TD>
                <TD>{naira(declaration.educationFundAmount)}</TD>
              </TR>
              <TR>
                <TD>Dividend</TD>
                <TD>{pct(declaration.dividendRate)}</TD>
                <TD>{naira(declaration.dividendAmount)}</TD>
              </TR>
              <TR>
                <TD>Honorarium</TD>
                <TD>{pct(declaration.honorariumRate)}</TD>
                <TD>{naira(declaration.honorariumAmount)}</TD>
              </TR>
              <TR>
                <TD>Meeting expenses</TD>
                <TD>{pct(declaration.meetingExpensesRate)}</TD>
                <TD>{naira(declaration.meetingExpensesAmount)}</TD>
              </TR>
              <TR className="font-semibold">
                <TD>Total</TD>
                <TD>100%</TD>
                <TD>{naira(declaration.declaredSurplus)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dividend pool split</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">
              Savings pool ({pct(declaration.dividendSavingsRatio)})
            </p>
            <p className="text-lg font-semibold">{naira(declaration.dividendSavingsPool)}</p>
            <p className="text-xs text-muted-foreground">Total eligible savings: {naira(declaration.totalEligibleSavings)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Loan-repayment pool ({pct(declaration.dividendRepaymentRatio)})
            </p>
            <p className="text-lg font-semibold">{naira(declaration.dividendRepaymentPool)}</p>
            <p className="text-xs text-muted-foreground">
              Total eligible repayments this year: {naira(declaration.totalEligibleRepayments)}
            </p>
          </div>
          {Number(declaration.unallocatedRepaymentPool) > 0 && (
            <div className="sm:col-span-2">
              <Badge tone="amber">
                {naira(declaration.unallocatedRepaymentPool)} of the loan-repayment pool is UNALLOCATED — no member had
                recorded loan repayments in {declaration.year}, so nobody qualified for that component.
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-member dividend ({result.total} members)</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Eligible savings</TH>
              <TH>Eligible repayments</TH>
              <TH>Savings dividend</TH>
              <TH>Repayment dividend</TH>
              <TH>Total dividend</TH>
            </TR>
          </THead>
          <TBody>
            {result.items.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Link href={`/members/${a.memberId}`} className="text-primary underline">
                    {a.member.fullName}
                  </Link>
                  <span className="ml-1 text-xs text-muted-foreground">({a.member.membershipNumber})</span>
                </TD>
                <TD>{naira(a.eligibleSavings)}</TD>
                <TD>{naira(a.eligibleRepayments)}</TD>
                <TD>{naira(a.savingsDividend)}</TD>
                <TD>{naira(a.repaymentDividend)}</TD>
                <TD className="font-semibold">{naira(a.totalDividend)}</TD>
              </TR>
            ))}
            {result.items.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  No members on record.
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
